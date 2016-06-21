var gulp = require('gulp');
var nodemon = require('gulp-nodemon');

// --- Constants
const PORT = 8081;
const CLIENT_ID = 'd9a6bf2def56028f9dfae4d22a0f8564';
const CLIENT_SECRET = 'ca8cae3c71e879306b339f9ff0e503a5';
const REDIRECT_URI = `http://localhost:${PORT}/callback`;


// --- Server Task
gulp.task('server', function () {
    nodemon({
        script: 'server.js',
        ext: 'js html',
        args:['--use-strict'],
        env: {
            'NODE_ENV': 'development',
            'PORT': PORT,
            'CLIENT_ID': CLIENT_ID,
            'CLIENT_SECRET': CLIENT_SECRET,
            'REDIRECT_URI': REDIRECT_URI
        }
    });
});


gulp.task('update', function() {
    var SoundcloudDownloader = require('./SoundcloudDownloader');

    var controller = new SoundcloudDownloader(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

    var userIds = Object.keys(require('./tracks.json'));

    function updateNextUser() {
        if(userIds.length > 0) {
            var id = userIds.shift();

            controller.updateUserFavorites(id, updateNextUser);
        } else {
            console.log('---- ALL UPDATES COMPLETE');
        }
    }

    updateNextUser();
});


gulp.task('resume', function() {
    var SoundcloudDownloader = require('./SoundcloudDownloader');

    var controller = new SoundcloudDownloader(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

    var userIds = Object.keys(require('./tracks.json'));

    function updateNextUser() {
        if(userIds.length > 0) {
            var id = userIds.shift();

            controller.resumeDownloads(id, updateNextUser);
        } else {
            console.log('---- ALL UPDATES COMPLETE');
        }
    }

    updateNextUser();
});


gulp.task('default', ['server']);