const express = require('express');
// Import the appropriate service
const {smarthome} = require('actions-on-google');
const {Device} = require('../db/index');
const protocol = require('../protocol/index');
const jsonWebToken = require('jsonwebtoken');
const config = require('../config');
const uuid = require('uuid');
const asyncHandler = require('express-async-handler');
const debug = require('debug')('google-home');

// Create an app instance
const app = smarthome({
	jwt: config.smarthomejwt
});

module.exports = exports = express.Router();

module.exports.route('/fulfillment')
	.post(app)
	.all(function (req, res) {
		res.send(405).end();
	});

const getUserByAuthHeader = (authHeader) => {
	const token = (authHeader || "").substr(7);

    const decoded = jsonWebToken.verify(token, config.jwt.secret);

    debug(decoded);

    return decoded;

};

const validateAccessToken = asyncHandler(async (req, res, next) => {

	const user = await getUserByAuthHeader(req.header("Authorization"));

	if (user) {
		req.user = user;
		next();
	} else {
		const err = new Error('Invalid token');
		err.status = 401;
		next(err);
	}

});

exports.use(validateAccessToken);


const getDeviceState = (device) => {
	return {
		online: device.online,
		...device.params
	};
};

const getGoogleDeviceType = (type) => {
	return "action.devices.types." + type;
};

const getGoogleTrait = (trait) => {
	return "action.devices.traits." + trait;
};


const updateDevice = async (execution, apikey, deviceid, commands) => {

	// TODO: we should check the command and filter/translate the params...

	try {
		const res = await protocol.postRequest({
			action: 'update',
			params: execution.params,
			deviceid: deviceid,
			apikey: apikey,
			userAgent: 'google'
		});

		commands.push({
			ids: [deviceid],
			status: 'SUCCESS',
			states: {
				online: true,
				...(res.params || execution.params)
			},
		});

	} catch (err) {

		if (err && err.error === 503) {
			commands.push({
				ids: [deviceid],
				status: 'OFFLINE'
			})
		} else {
			commands.push({
				ids: [deviceid],
				status: 'ERROR',
				errorCode: err && (err.reason || err.error)
			})
		}

	}
};

// Register handlers for Smart Home intents

app.onExecute(async (body, headers) => {

	const user = await getUserByAuthHeader(headers.authorization);

	debug("onExecute");
	debug(JSON.stringify(body, null, 4));

	const {requestId} = body;
	// Execution results are grouped by status

	const commands = [];

	const executePromises = [];
	const intent = body.inputs[0];
	for (const command of intent.payload.commands) {
		for (const device of command.devices) {
			for (const execution of command.execution) {
				executePromises.push(
					updateDevice(execution, user.apikey, device.id, commands)
				);
			}
		}
	}
	await Promise.all(executePromises);

	const result = {
		requestId: requestId,
		payload: {
			commands: commands,
		},
	};

	debug(JSON.stringify(result, null, 4));

	return result;
});

app.onQuery(async (body, headers) => {

	const user = await getUserByAuthHeader(headers.authorization);

	debug("onQuery");
	debug(JSON.stringify(body, null, 4));

	const payload = {
		devices: {},
	};
	const queryPromises = [];
	const intent = body.inputs[0];
	for (const device of intent.payload.devices) {
		const deviceId = device.id;
		queryPromises.push(Device.exists(user.apikey, deviceId)
			.then((device) => {
					// Add response to device payload
					payload.devices[deviceId] = getDeviceState(device);
				}
			));
	}

	await Promise.all(queryPromises);

	const result = {
		requestId: body.requestId,
		payload: payload,
	};

	debug(JSON.stringify(result, null, 4));

	return result
});

app.onSync(async (body, headers) => {

	const user = await getUserByAuthHeader(headers.authorization);

	debug("onSync");
	debug(JSON.stringify(body, null, 4));

	const devices = await Device.getDevicesByApikey(user.apikey);

	const result = {
		requestId: body.requestId,
		payload: {
			agentUserId: user.apikey,
			devices: devices.map(device => {
				return {
					id: device.deviceid,
					type: getGoogleDeviceType(device.type),
					traits: device.traits.map(getGoogleTrait),
					attributes: device.attributes,
					name: {
						name: device.name,
					},
					willReportState: true
				}
			})
		},
	};

	debug(JSON.stringify(result, null, 4));

	return result;
});

app.onDisconnect(async (body, headers) => {
	debug("onDisconnect");
	debug(JSON.stringify(body, null, 4));
	// TODO remove access tokens (?)
});

protocol.on('device.update', function (req) {

	const requestBody = {
		requestId: uuid.v4(), /* Any unique ID */
		agentUserId: req.apikey, /* Hardcoded user ID */
		payload: {
			devices: {
				states: {
					/* Report the current state of our washer */
					[req.deviceid]: {
						...req.params
					},
				},
			},
		},
	};

	debug("Report state: ", JSON.stringify(requestBody, null, 4));

	app.reportState(requestBody)
		.then(res => debug('Report state response:', res))
		.catch(err => debug('Report state ' + req.deviceid, err));

});

protocol.on('device.change', function (req) {

	app.requestSync(req.apikey)
		.then(res => debug('Request sync ' + req.apikey + ':', res))
		.catch(err => debug('Request sync ' + req.apikey, err));
});
