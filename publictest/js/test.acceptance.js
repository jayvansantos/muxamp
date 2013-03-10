describe('Opening Muxamp', function() {
	it('should load SoundCloud', function(done) {
		soundManager.should.not.be.null;
		soundManager.onready(function() {
            assert.ok(true, "SoundManager 2 loaded.");
            done();
        });
	});
	it('should initialize the playlist', function() {
		Playlist.should.not.be.null;
	});
	it('should initialize the router', function() {
		Router.should.not.be.null;
	});
});

describe('Routing', function() {
	var checkFetch = function(id, data) {
		data.should.be.an('object');
		data.id.should.eql(id);
		data.tracks.should.be.an('array');
		data.tracks.length.should.be.above(0);
	};
	var asyncFetchVerifier = function(id, done) {
		return function(data) {
			checkFetch(id, data);
			done();
		};
	};
	it('should be able to fetch a playlist', function(done) {
		Router.load(150).then(asyncFetchVerifier(150, done));
	});
	it('should be able to fetch playlists in sequence', function(done) {
		Router.load(151).then(function(data) {
			checkFetch(151, data);
		}).then(function() {
			return Router.load(153);
		}).then(asyncFetchVerifier(153, done));
	})
});

describe('Playlist', function() {
	it('should have content for this set of tests', function() {
		Playlist.size().should.be.above(0);
	});
	describe('YouTube capabilities', function() {
		it('should be able to play a video', function(done) {
			Playlist.once('play', function() {
				Playlist.currentMedia.should.not.be.null;
				Playlist.currentMedia.get('siteCode').should.eql('ytv');
				Playlist.isPlaying().should.be.true;
				Playlist.isPaused().should.be.false;
				done();
			});
			Playlist.play();
		});
		it('should be able to pause a video', function(done) {
			Playlist.once('pause', function() {
				Playlist.currentMedia.should.not.be.null;
				Playlist.isPlaying().should.be.true;
				Playlist.isPaused().should.be.true;
				done();
			});
			Playlist.togglePause();
		});
	});
	describe('SoundCloud capabilities', function() {
		it('should be able to play a track', function(done) {
			Playlist.nextTrack(false);
			Playlist.isPlaying().should.be.false;
			Playlist.currentMedia.get('siteCode').should.eql('sct');
			Playlist.once('play', function() {
				Playlist.currentMedia.should.not.be.null;
				Playlist.isPlaying().should.be.true;
				Playlist.isPaused().should.be.false;
				done();
			});
			Playlist.play();
		});
		it('should be able to pause a track', function(done) {
			Playlist.once('pause', function() {
				Playlist.currentMedia.should.not.be.null;
				Playlist.isPlaying().should.be.true;
				Playlist.isPaused().should.be.true;
				done();
			});
			Playlist.togglePause();
		});
	});
	describe('interaction', function() {
		it('should be able to go forward in the track list', function() {
			firstTrack = Playlist.currentMedia;
			Playlist.nextTrack();
			firstTrack.should.not.eql(Playlist.currentMedia);
		});
	})
});

describe('Search', function() {
	var testTrack = function(track) {
		track.should.be.an('object');
		track.should.not.be.empty;
		track.siteMediaID.should.not.be.empty;
		track.duration.should.be.above(0);
	};
	it('should not have results on page open', function() {
		SearchResults.size().should.eql(0);
	});
	it('should be able to search YouTube', function(done) {
		SearchResults.search('lady gaga', 'ytv').then(function(results) {
			results.should.be.an('array');
			results.length.should.be.above(0);
			testTrack(results[0]);
			done();
		});
	});
	it('should be able to search SoundCloud', function(done) {
		SearchResults.search('deadmau5', 'sct').then(function(results) {
			results.should.be.an('array');
			results.length.should.be.above(0);
			testTrack(results[0]);
			done();
		});
	});
	it('should be able to get a second page of search results', function(done) {
		SearchResults.nextPage().then(function(results) {
			results.should.be.an('array');
			results.length.should.be.above(0);
			testTrack(results[0]);
			done();
		});
	});
	it('should be able to retrieve SoundCloud media based on a URL', function(done) {
		SearchResults.search('https://soundcloud.com/fuckmylife/arm1n_3', 'url').then(function(results) {
			results.should.be.an('array');
			results.length.should.be.above(0);
			testTrack(results[0]);
			done();
		});
	});
});