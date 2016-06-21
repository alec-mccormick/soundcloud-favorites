'use strict';

var fs = require('fs');
var https = require('https');
var querystring = require('querystring');
const StringDecoder = require('string_decoder').StringDecoder;
const decoder = new StringDecoder('utf8');

var SC = require('node-soundcloud');
var _ = require('lodash');

function handleError(successCallback) {
    return function(err, data) {
        if ( err ) {
            console.error(err);
            throw err;
        } else {
            successCallback(data);
        }
    }
}


class SoundcloudDownloader {

    // --- Initialization
    constructor(clientId, clientSecret, redirectUri) {
        this._handleUserUpdateComplete = function(){};

        SC.init({
            id: clientId,
            secret: clientSecret,
            uri: redirectUri
        });
    }

    getConnectUrl() {
        return SC.getConnectUrl();
    }

    // --- Authorization
    authorize(code) {
        SC.authorize(code, handleError(this.handleAuthorization.bind(this)));
    }

    handleAuthorization(accessToken) {
        // Client is now authorized and able to make API calls

        this.accessToken = accessToken;
        this.getUserInformation();
    }

    // =====================================
    // --- User Information
    // =====================================
    getUserInformation() {
        SC.get('/me', handleError(this.handleUserInformation.bind(this)));
    }

    handleUserInformation(me) {
        console.log('ME', me);

        this.updateUserFavorites(me.id);
    }

    // =====================================
    // --- Update User Favorites
    // =====================================
    initTrackList(userId) {
        this.userId = userId;

        if (fs.existsSync('./tracks.json')) {
            this.tracks = require('./tracks.json');
        } else {
            this.tracks = {};
        }

        this.tracks[this.userId] = this.tracks[this.userId] || {};
    }

    updateUserFavorites(userId, handleComplete) {
        console.log('---------------------------------');
        console.log('---- Updating favorites list for user:', userId);
        console.log('---------------------------------');

        this._handleUserUpdateComplete = handleComplete || function(){};

        this.initTrackList(userId);

        this.cursor = undefined;
        this.getNextFavoritesPage();
    }

    getNextFavoritesPage() {
        console.log('Retrieving next page...');
        this.saveTracksFile();

        var id = this.userId;

        var params = {
            linked_partitioning: 1,
            cursor: this.cursor
        };

        SC.get(`/users/${id}/favorites`, params, handleError(this.handleFavoritesPage.bind(this)));
    }
    handleFavoritesPage(data) {
        // --- Save each favorite
        data.collection.forEach(track => this.saveFavorite(track));

        // --- If there are more favorites left, get the next page. Otherwise move on to downloading.
        if(data.collection.length > 0 && data.next_href) {
            var params = querystring.parse(data.next_href.split('?')[1]);

            this.cursor = params.cursor;

            this.getNextFavoritesPage();
        } else {
            this.runDownloads();
        }
    }
    saveFavorite(favorite) {
        // --- Add track to our favorites list if it doesn't already exists & it's streamable.
        if(!this.tracks[this.userId][favorite.id] && favorite.streamable) {

            if(favorite.kind === 'track') {
                this.tracks[this.userId][favorite.id] = {
                    id: favorite.id,
                    downloaded: false,
                    permalink: favorite.permalink
                };
            } else {
                console.log('FAVORITE', favorite);
            }
            if(favorite.kind === 'playlist') {
                // --- If it's a playlist, save each track in the playlist
                favorite.tracks.forEach(track => this.saveFavorite(track));
            }
        }
    }

    // =====================================
    // --- Download Track
    // =====================================
    runDownloads() {
        this.saveTracksFile();

        // --- Create downloads directory if it doesn't exist
        if(!fs.existsSync('./downloads')) {
            fs.mkdirSync('./downloads');
        }

        // --- Get list of tracks and filter it down to those that haven't been downloaded. Convert result to an array.
        var tracks = this.tracks[this.userId];
        this.undownloadedTracks = _.toArray(_.reject(tracks, 'downloaded'));

        console.log('---- Favorites list updated ----');
        console.log(`---- Downloading ${this.undownloadedTracks.length} Songs ----`);

        // --- Start download process
        this.downloadNextTrack();
    }

    downloadNextTrack() {
        // --- Get track off top of download queue
        var track = this.undownloadedTracks.pop();

        console.log(`---- Downloading: ${track.permalink}.mp3 | ${this.undownloadedTracks.length} tracks remaining`);

        // --- If this is the last track then we move ahead upon completion, otherwise download the next track in the queue.
        var onCompleteCallback = (this.undownloadedTracks.length === 0)
            ? this.handleDownloadingFinished.bind(this)
            : this.downloadNextTrack.bind(this);

        this.downloadTrack(track, onCompleteCallback);
    }

    downloadTrack(track, callback) {
        // --- Retrieve MP3 URL from Soundcloud API for this track
        https.get(`https://api.soundcloud.com/i1/tracks/${track.id}/streams?client_id=${SC.clientId}`, res => {
            res.on('data', (d) => {
                var data = JSON.parse(decoder.write(d));

                // --- If there's an error, skip this song
                if(!data.http_mp3_128_url) {
                    console.error('!!!! Error downloading: ', track.permalink);

                    if(callback) {
                        callback();
                    }

                    return;
                }

                // --- Download the mp3 url
                this.downloadMp3Url(track, data.http_mp3_128_url, callback);
            });
        });
    }
    downloadMp3Url(track, url, callback) {
        var fileName = track.permalink + '.mp3';

        var file = fs.createWriteStream(`./downloads/${fileName}`);

        https.get(url, res => {
            res.pipe(file);

            res.on('end', () => {
                this.tracks[this.userId][track.id].downloaded = true;
                this.saveTracksFile();

                if(callback) {
                    callback();
                }
            });
        });
    }

    handleDownloadingFinished() {
        console.log("---- DOWNLOADING FINISHED");
        this._handleUserUpdateComplete();
    }

    resumeDownloads(userId, handleComplete) {
        this._handleUserUpdateComplete = handleComplete || function(){};

        this.initTrackList(userId);

        this.runDownloads();
    }


    // =====================================
    // --- Save JSON
    // =====================================
    saveTracksFile() {
        fs.writeFile('./tracks.json', JSON.stringify(this.tracks, null, 2));
    }


}


module.exports = SoundcloudDownloader;