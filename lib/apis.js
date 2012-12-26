var SearchResult	= require('./searchresult').SearchResult,
	_				= require('underscore')._,
	Q 				= require('q'),
	request 		= require('request'),
	url 			= require('url');

var getSeparatedWords = function(query) {
	return query.replace(/[^\w\s]|_/g, ' ').toLowerCase().split(' ');
};

var missingProperties = function(object, expected) {
	return _.reject(expected, function (element) {
		return object[element] != null;
	}).toString();
}

var verifyUrl = function(input) {
    if (! _.isString(input)) {
        return false;
    }
    var parsed = urlParser.parse(input);
    return (parsed && parsed.href);
};

var RetrieveApi = function(params){
	var defaultOptions = {
		json: true,
		method: 'GET',
		timeout: 7500,
		url: ''
	};
	this.options = _.extend({}, defaultOptions, params.options || {});
	_.extend(this, _.omit(params, 'options'));
};

RetrieveApi.prototype = {
	getOne: function(entry) {return null;},
	locate: function(input, promise) {
		if (_.isString(input) && verifyUrl(input)) {
			return this.ownsUrl(input);
		} else {
			return this.ownsMedia(input, promise);
		}
	},
	ownsMedia: function(media, promise) {
		var match = media && media.key && media.key == this.siteCode && media.value;

		// Returns if no promise needed
		if (!!!promise) {
			return match;
		}

		var deferred = Q.defer();
		if (match) {
			deferred.resolve(match);
		} else {
			deferred.reject();
		}
		return deferred.promise;
	},
	ownsUrl: function(url, promise) {
		if (!!!promise) {
			return false;
		}

		var deferred = Q.defer();
		deferred.reject({error: 'Nop'});
		return deferred.promise;
	},
	request: function(params) {
		var api = this, deferred, callback, options, url;
		deferred = Q.defer();
		callback = api.getOne;
		url = this.url(params);
		options = _.extend({}, this.options, {url: url});
		request(options, function(error, response, body) {
			if (error) {
				deferred.reject({
					error: error
				});
				return;
			}
			if (response.statusCode != 200) {
				deferred.reject({
					error: 'Received code ' + response + ' from ' + url
				});
				return;
			}

			var results = callback(body) || {error: 'There was a problem getting search results.'};
			if (results.error) {
				deferred.reject(results);
			}
			deferred.resolve({tracks: results});
		});
		return deferred.promise;
	},
	siteCode: 'nope'
};

var SearchApi = function(params){
	var defaultOptions = {
		json: true,
		method: 'GET',
		timeout: 7500,
		url: ''
	};
	this.options = _.extend({}, defaultOptions, params.options || {});
	_.extend(this, _.omit(params, 'options'));
};

SearchApi.prototype = {
	callback: function() {return function() {};},
	checkedProperties: [],
	consumerKey: '',
	search: function(params) {
		var api = this, deferred, callback, options, url;
		deferred = Q.defer();
		if ( !(params && params.query && _.isNumber(params.page) && _.isNumber(params.perPage)) ) {
			deferred.reject({error: 'Search parameters must include a query, page number, and results per page.'});
			return deferred.promise;
		}
		callback = api.callback;
		url = this.url(params);
		options = _.extend({}, this.options, {url: url});
		request(options, function(error, response, body) {
			if (error) {
				deferred.reject({
					error: error
				});
				return;
			}
			if (response.statusCode != 200) {
				deferred.reject({
					error: 'Received code ' + response + ' from ' + url
				});
				return;
			}

			var results = callback(body) || {error: 'There was a problem getting search results.'};
			if (results.error) {
				deferred.reject(results);
			}
			results = api.sort(results, params);
			deferred.resolve({tracks: results});
		});
		return deferred.promise;
	},
	sort: function(tracks, options) {
		if (!tracks) {
			return [];
		}

		var allPlaybacks = 0,
			avgPlaybacks = 0,
			maxPlays = 0,
			maxFavorites = 0,
			missingPlays = [],
			queryWords = getSeparatedWords(options.query);

		_(tracks).each(function(result) {
			var resultWords, intersection;
			resultWords = getSeparatedWords(result.author + ' ' + result.mediaName);
			intersection = _.intersection(queryWords, resultWords);
			result.querySimilarity = intersection.length / queryWords.length;
			if (undefined === result.plays) {
				missingPlays.push(result);
			} else {
				allPlaybacks += result.plays;
			}
		});
		avgPlaybacks = allPlaybacks / tracks.length || 0;
		// If a track is missing playbacks, we give it the average number of playbacks
		// with a slight penalty; we devide by the number of total tracks, 
		// not the number with recorded plays.
		_(missingPlays).each(function(track, i) {
			tracks[i].plays = avgPlaybacks;
		});

		maxPlays = _(tracks).max(function(result) {
			return result.plays;
		});
		maxFavorites = _(tracks).max(function(result) {
			return result.favorites;
		});
		return _.chain(tracks).map(function(result) {
			// Calculates relevance of each track
			result.playRelevance = Math.log(result.plays + 1) / Math.log(maxPlays + 1);
			result.favoriteRelevance = Math.log(result.favorites + 1) / Math.log(maxFavorites + 1);
			result.calculateRelevance();
			return result;
		}).sortBy(function(a) {
			// Sorts tracks by relevance
			return a.relevance;
		}).reverse().map(function(result) {
			// Deletes unnecessary properties to minimize data sent over the wire
			delete result.favoriteRelevance;
			delete result.favorites;
			delete result.playRelevance;
			delete result.plays;
			delete result.querySimilarity;
			delete result.relevance;
			return result;
		}).value();
	},
	url: function(options) {return '';}
};

var SoundCloud = new function() {
	var getOne = function(entry) {
		var missingProps = missingProperties(entry, this.checkedProperties);
		if (missingProps) {
			console.log('SoundCloud entry ' + (entry.id || 'unknown') + ' is missing properties: ', missingProps);
			return null;
		}
		var searchResult = new SearchResult(entry.stream_url + "?client_id=" + this.consumerKey, entry.permalink_url, entry.id, "sct", "img/soundcloud_orange_white_16.png", entry.user.username, entry.title, entry.duration / 1000, "audio", entry.playback_count, entry.favoritings_count);
		return searchResult;
	};
	var searchApi = new SearchApi({
		checkedProperties: [
		'stream_url', 'permalink_url', 'streamable'
		],
		consumerKey: '2f9bebd6bcd85fa5acb916b14aeef9a4',
		callback: function(body) {
			var api = this;
			if (!body.length) {
				return [];
			}
			var allPlaybacks = 0,
				avgPlaybacks = 0,
				missingPlays = [],
				searchResults;
			searchResults = _(body).map(function(entry) {
				return getOne.call(api, entry);
			});
			return searchResults;
		},
		url: function(options) {
			var query = options.query,
			page = options.page,
			perPage = options.perPage;
			return 'http://api.soundcloud.com/tracks.json?client_id=' + this.consumerKey + '&limit=' + 
				perPage + '&filter=streamable&order=hotness&offset=' + (perPage * page + 1) + 
				'&q=' + encodeURIComponent(query);
		}
	});
	var Tracks = {
		search: function(options) {
			return searchApi.search(options);
		},
		siteCode: 'sct'
	};
	this.Tracks = Tracks;
	this.toString = function() {
		return "SoundCloud";
	};
};

var YouTube = new function() {
	var getOne = function(entry) {
		var id = '', missingProps = missingProperties(entry, this.checkedProperties);
		if (missingProps) {
			var id = 'unknown';
			if (entry && entry['id'] && entry['id']['$t']) {
				id = entry['id']['$t'].split(':').pop();
			}
			console.log("YouTube entry " + id + ' is missing properties: ', missingProps);
			return null;
		}
		id = entry['id']['$t'].split(':').pop();
		var permalink = 'http://www.youtube.com/watch?v=' + id;
		var authorObj = entry.author[0];
        var author = authorObj.name.$t;
		var title = entry.title.$t;
        var duration = parseInt(entry.media$group.yt$duration.seconds);
        var viewCount = entry['yt$statistics']['viewCount'];
        var favoriteCount = entry['yt$statistics']['favoriteCount'];
        
        var searchResult = new SearchResult(permalink, permalink, id, "ytv", "img/youtube.png", author, title, duration, "video", viewCount, favoriteCount);
		return searchResult;
	}
	var searchApi = new SearchApi({
		checkedProperties: [
			'author', 'title', 'yt$statistics', 'media$group'
		],
		callback: function(body) {
			var api = this;
			if ( !(body.feed && body.feed.entry && body.feed.entry.length) ) {
				return [];
			}
			return _(body.feed.entry).map(function(entry) {
				return getOne.call(api, entry);
			});
		},
		options: {
			strictSSL: false,
	        timeout: 4000
		},
		url: function(options) {
			var query = options.query,
			page = options.page,
			perPage = options.perPage;
			return 'https://gdata.youtube.com/feeds/api/videos?v=2&format=5&max-results=' + 
				perPage + '&orderby=relevance&alt=json&start-index=' + (perPage * page + 1) + 
				'&q=' + encodeURIComponent(query);
		}
	});
	var Tracks = {
		search: function(options) {
			return searchApi.search(options);
		},
		siteCode: 'ytv'
	};
	this.Tracks = Tracks;
	this.toString = function() {
		return "YouTube";
	};
};

module.exports = {
	SoundCloud: SoundCloud,
	YouTube: YouTube
}