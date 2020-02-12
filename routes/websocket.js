/**
 * Dependencies
 */
const Server = require('ws').Server;
const protocol = require('../protocol/index');
const mixin = require('utils-merge');
const jwt = require('jsonwebtoken');
const config = require('../config');
const url = require('url');
const Device = require('../db').Device;

/**
 * Private variables and functions
 */

const devices = {}; // { deviceid: [ws, ws, ws] }
const apps = {};  // { deviceid: [ws, ws, ws] }

const clean = function (ws) {
	if (ws.deviceid) {
		const deviceid = ws.deviceid;
		if (Array.isArray(devices[deviceid]) && devices[deviceid][0] === ws) {
			delete devices[deviceid];
			protocol.postMessage({
				type: 'device.online',
				deviceid: deviceid,
				online: false
			});
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
	if (msg.action && msg.deviceid && msg.apikey) return Types.REQUEST;

	if (typeof msg.error === 'number') return Types.RESPONSE;

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
	console.debug(JSON.stringify(req));
	postRequestToApps(req);
});

protocol.on('app.update', function (req) {
	devices[req.deviceid] && devices[req.deviceid].forEach(function (ws) {
		postRequest(ws, req);
	});
});

/**
 * Exports
 */

module.exports = function (httpServer) {

	const server = new Server({
		server: httpServer,
		path: '/api/ws',
	});

	server.on('connection', async function (ws, req) {

		try {
			const query = url.parse(req.url, true).query;

			if (query.deviceid && query.apikey) {

				const device = await Device.exists(query.apikey, query.deviceid);
				if (!device) {
					throw new Error("device not found for " + query.apikey + " " + query.deviceid);
				}

				ws.deviceid = query.deviceid;
			} else if (query.jwt) {
				const decoded = jwt.verify(query.jwt, config.jwt.secret, config.jwt);
				ws.apikey = decoded.apikey;
			} else {
				throw new Error("no credentials");
			}
		} catch (e) {
			console.error(e);
			ws.send(JSON.stringify({error: 401}));
			ws.close();
		}

		ws.on('message', function (msg) {

			try {
				msg = JSON.parse(msg);
			} catch (err) {
				// Ignore non-JSON message
				return;
			}

			switch (getType(msg)) {
				case Types.UNKNOWN:
					return;

				case Types.RESPONSE:
					protocol.postResponse(msg);
					return;

				case Types.REQUEST:
					msg.ws = ws;

					if (ws.deviceid) {
						msg.deviceid = ws.deviceid;
					}

					if (ws.apikey) {
						msg.apikey = ws.apikey;
					}

					protocol.postRequest(msg, function (res) {
						ws.send(JSON.stringify(res));

						if (res.error) return;

						// Message sent from device
						if (protocol.utils.fromDevice(msg)) {
							devices[msg.deviceid] = devices[msg.deviceid] || [];

							if (devices[msg.deviceid][0] === ws) return;

							devices[msg.deviceid] = [ws];
							protocol.postMessage({
								type: 'device.online',
								deviceid: msg.deviceid,
								online: true
							});

							return;
						}

						// Message sent from apps
						apps[msg.deviceid] = apps[msg.deviceid] || [];

						if (apps[msg.deviceid].indexOf(ws) !== -1) return;

						apps[msg.deviceid].push(ws);
					});
			}
		});


		ws.on('close', function () {
			clean(ws);
		});

		ws.on('error', function () {
			clean(ws);
		});

	});

};
