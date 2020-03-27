/**
 * Dependencies
 */
const express = require('express');
const db = require('../db/index');
const http = require('./http');
const config = require('../config');
const user = require('./user');
const admin = require('./admin');
const google = require('./google-smart-home');
const oauth = require('./oauth');
const console = require('console');

/**
 * Connect to database first
 */
db.connect(config.db.uri,
	{
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useCreateIndex: true,
		useFindAndModify: false,
		...config.db.options,
	})
	.then(() => console.info('Connect to DB successful!'))
	.catch(err => {
		console.error('Connect to DB failed!');
		console.error(err);
		process.exit(1);
	});

const router = express.Router();

router.route('/http')
	.post(http)
	.all(function (req, res) {
		res.send(405).end();
	});

router.use('/user', user);
router.use('/admin', admin);

router.use('/google', google);

router.use('/oauth', oauth);

module.exports = router;