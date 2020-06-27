/**
 * Dependencies
 */
const {Device, FactoryDevice} = require('../db/index');
const interceptors = require('./interceptors');
const EventEmitter = require('events').EventEmitter;

/**
 * Exports
 */
module.exports = exports = {
	...EventEmitter.prototype
};

exports.register = async function (req) {
	const factoryDevice = await FactoryDevice.exists(req.apikey, req.deviceid);

	if (!factoryDevice) {
		throw (interceptors(req, {
			error: 403,
			reason: 'Forbidden'
		}));
	}

	const device = await Device.getDeviceByDeviceid(req.deviceid);

	if (!device) {
		throw interceptors(req, {
			error: 404,
			reason: 'Not Found'
		});
	}

	// TODO: do we need a way to reset the ownership of the device?
	return interceptors(req, {
		error: 0,
		apikey: device.apikey
	});
};

exports.update = async function (req) {

	if (typeof req.params !== 'object') {
		throw interceptors(req, {
			error: 400,
			reason: 'Bad Request'
		});
	}

	const device = await Device.exists(req.apikey, req.deviceid);

	if (!device) {
		throw interceptors(req, {
			error: 403,
			reason: 'Forbidden'
		});
	}

	const reqParams = req.params;

	device.params = {
		...device.params,
		...reqParams
	};

	device.markModified('params');
	await device.save();

	exports.emit('update', req);

	return interceptors(req, {
		error: 0,
		params: device.params
	});
};

exports.query = async function (req) {

	const device = await Device.exists(req.apikey, req.deviceid);

	if (!device) {
		throw interceptors(req, {
			error: 403,
			reason: 'Forbidden'
		});
	}

	if (!req.params || !req.params.length) {
		return interceptors(req, {
			error: 0,
			params: device.params
		});
	}

	const params = {};

	req.params.forEach(function (item) {
		if (item in device.params) {
			params[item] = device.params[item];
		}
	});

	return interceptors(req, {
		error: 0,
		params: params
	});

};

exports.date = function (req) {
	return interceptors(req, {
		error: 0,
		date: (new Date()).toISOString()
	});
};
