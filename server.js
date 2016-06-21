'use strict';

// --- Imports
var express = require('express');
var SoundcloudDownloader = require('./SoundcloudDownloader');
var Routes = require('./routes');


// --- Initialization
var app = express();
var controller = new SoundcloudDownloader(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URI);

Routes.initialize(app, controller);


// --- Register routes
Routes.register('/');
Routes.register('/callback');




var server = app.listen(process.env.PORT, function () {
    var port = server.address().port

    console.log("Example app listening at http://localhost:%s", port)
});
