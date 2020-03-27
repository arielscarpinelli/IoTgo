const express = require('express');
const favicon = require('serve-favicon');
const logger = require('morgan');
const bodyParser = require('body-parser');

const routes = require('./routes/index');

const app = express();

// web app backend
app.use('/admin', favicon(__dirname + '/public/backend/favicon.png'));
app.use('/admin', express.static(__dirname + '/public/backend'));

// web app frontend
app.use(favicon(__dirname + '/public/frontend/favicon.png'));
app.use(express.static(__dirname + '/public/frontend'));

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use('/api', routes);

// catch 404 and redirect to /
app.use(function (req, res, next) {
	res.status(200).sendFile('/', {root: __dirname + '/public/frontend'});
});

// error handlers

app.use(function (err, req, res, next) {
	if (!err.status) { // not an expected error
		console.error(err.stack || err.message || err);
	}
	res.status(err.status || 500);
	res.send({ error: err.message || 'Unexpected error' });
	res.end();
});

module.exports = app;
