/**
 * Dependencies
 */
const {Server} = require('ws');
const protocol = require('../protocol/index');
const jwt = require('jsonwebtoken');
const config = require('../config');
const url = require('url');
const {Device} = require('../db');
const {unauthorizedError} = require('../lib/errors');
const debug = require('debug')('websocket');

/**
 * Private variables and functions
 */

const devices = {}; // { deviceid: [ws, ws, ws] }
const apps = {};  // { deviceid: [ws, ws, ws] }

const clean = function (ws) {
	const deviceid = ws.deviceid;
	if (deviceid) {
		debug('clean ' + deviceid);
		if (Array.isArray(devices[deviceid]) && devices[deviceid][0] === ws) {
			delete devices[deviceid];
			protocol.notifyDeviceOnline(deviceid, false)
				.catch(debug);
		}

		var pos, wsList = apps[deviceid];
		if (wsList && (pos = wsList.indexOf(ws)) !== -1) {
			wsList.splice(pos, 1);
			if (wsList.length === 0) delete apps[deviceid];
		}
	}
};

const Types = {
	'REQUEST': 1,
	'RESPONSE': 2,
	'UNKNOWN': 0
};

const getType = function (msg) {
	if (msg.action && msg.deviceid && msg.apikey) {
		return Types.REQUEST;
	}

	if (typeof msg.error === 'number') {
		return Types.RESPONSE;
	}

	return Types.UNKNOWN;
};

const postRequest = function (ws, req) {
	if (req.ws && req.ws === ws) {
		return;
	}

	ws.send(JSON.stringify(req, function (key, value) {
		if (key === 'ws') {
			// exclude property ws from resulting JSON string
			return undefined;
		}
		return value;
	}));
};

const postRequestToApps = function (req) {
	apps[req.deviceid] && apps[req.deviceid].forEach(function (ws) {
		postRequest(ws, req);
	});
};

protocol.on('device.update', function (req) {
	postRequestToApps(req);
});

protocol.on('device.online', function (req) {
	postRequestToApps(req);
});

protocol.on('app.update', function (req) {
	devices[req.deviceid] && devices[req.deviceid].forEach(function (ws) {
		postRequest(ws, req);
	});
});

const handleError = ws => function (err) {
	debug(err);
	debug(err.stack);
	if (ws) {
		const code = err.status || err.error || 500;
		ws.send(JSON.stringify({
			error: code,
			reason: err.reason || err.message,
			deviceid: err.deviceid,
			apikey: err.apikey,
			sequence: err.sequence
		}));
		if ((code === 401) || (code === 403)) {
			ws.close();
		}
	}
};

const handleMessage = async function (ws, msg) {

	debug('req ' + (ws.deviceid || ws.apikey), msg);

	try {
		msg = JSON.parse(msg);
	} catch (err) {
		// Ignore non-JSON message
		return;
	}

	msg.ws = ws;

	if (ws.deviceid) {
		msg.deviceid = ws.deviceid;
	}

	if (ws.apikey) {
		msg.apikey = ws.apikey;
	}

	switch (getType(msg)) {
		case Types.UNKNOWN:
			return;

		case Types.RESPONSE:
			protocol.postResponse(msg);
			return;

		case Types.REQUEST:

			const res = await protocol.postRequest(msg);

			debug('res ' + (ws.deviceid || ws.apikey), res);
			ws.send(JSON.stringify(res));

			if (res.error) {
				return;
			}

			// Message sent from device
			if (protocol.utils.fromDevice(msg)) {
				devices[msg.deviceid] = devices[msg.deviceid] || [];

				if (devices[msg.deviceid][0] === ws) {
					return;
				}

				devices[msg.deviceid] = [ws];
				return protocol.notifyDeviceOnline(msg.deviceid, true);
			} else {
				// Message sent from apps
				apps[msg.deviceid] = apps[msg.deviceid] || [];

				if (apps[msg.deviceid].indexOf(ws) !== -1) {
					return;
				}

				apps[msg.deviceid].push(ws);
			}

	}
};


const connectionHandler = async function (ws, req) {

	ws.bufferedMessages = [];


	ws.on('message', msg => {

		if (!ws.deviceid && !ws.apikey) {
			// haven't checked credentials yet
			ws.bufferedMessages.push(msg);
			return;
		}

		handleMessage(ws, msg)
			.catch(handleError(ws))
	});

	const query = url.parse(req.url, true).query;

	if (query.deviceid && query.apikey) {

		const device = await Device.exists(query.apikey, query.deviceid);
		if (!device) {
			throw unauthorizedError("device not found for " + query.apikey + " " + query.deviceid);
		}

		ws.deviceid = query.deviceid;
	} else if (query.jwt) {
		const decoded = jwt.verify(query.jwt, config.jwt.secret, config.jwt);
		ws.apikey = decoded.apikey;
	} else {
		throw unauthorizedError("no credentials");
	}

	ws.bufferedMessages.forEach(msg => handleMessage(ws, msg)
		.catch(handleError(ws)));

	delete ws.bufferedMessages;

	ws.on('close', function () {
		clean(ws);
	});

	ws.on('error', function () {
		clean(ws);
	});

};

/**
 * Exports
 */

module.exports = function (httpServer) {

	const server = new Server({
		server: httpServer,
		path: '/api/ws',
	});

	server.on('connection', (ws, req) =>
		connectionHandler(ws, req)
			.catch(handleError(ws)));

	return server;
};
