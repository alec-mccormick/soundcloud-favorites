'use strict';



var Routes = {
    // --- API
    initialize: function(app, controller) {
        this.app = app;
        this.controller = controller;
    },
    register: function(path) {
        this.app.get(path, this[path].bind(this));
    },


    // --- List of routes
    '/': function(req, res) {
        res.redirect(this.controller.getConnectUrl());
    },

    '/callback': function(req, res) {
        var code = req.query.code;

        this.controller.authorize(code);

        res.send('This is the callback page.');
    },
    '/addUser': function(req, res) {
        var username = req.query.id;

        this.controller.updateUserFavorites(username);

        res.send(`Processing user: ${username}`);
    }
};




module.exports = Routes;