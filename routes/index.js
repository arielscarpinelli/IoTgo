/**
 * Dependencies
 */
var express = require('express');
var db = require('../db/index');
var http = require('./http');
var config = require('../config');
var user = require('./user');
var admin = require('./admin');
var google = require('./google-smart-home');
var oauth = require('./oauth');
var debug = require('debug')('iotgo');

/**
 * Connect to database first
 */
db.connect(config.db.uri, config.db.options);
db.connection.on('error', function (err) {
  debug('Connect to DB failed!');
  debug(err);
  process.exit(1);
});
db.connection.on('open', function () {
  debug('Connect to DB successful!');
});

var router = express.Router();

router.route('/http').post(http).all(function (req, res) {
  res.send(405).end();
});

router.use('/user', user);
router.use('/admin', admin);

router.use('/google', google);

router.use('/oauth', oauth);

module.exports = router;