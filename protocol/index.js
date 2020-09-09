/**
 * Dependencies
 */
const methods = require('./methods');
const interceptors = require('./interceptors');
const EventEmitter = require('events').EventEmitter;
const Device = require('../db/index').Device;
const config = require('../config');
const utils = require('./utils');
const debug = require('debug')('protocol');

/**
 * Private variables and functions
 */
const validate = function (req) {
	if (!req.action || !req.apikey || !req.deviceid) {
		return false;
	}

	if (!/^[0-9a-z]{8}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{12}$/.test(req.apikey)) {
		return false;
	}

	if (!/^[0-9a-z]{8}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{12}$/.test(req.deviceid)) {
		return false;
	}

	return true;
};

/**
 * { 'sequenceValue': { req: reqObj, callback: callbackFunc, timer: setTimeout() } }
 */
const pendingRequests = {};
const removePendingRequest = function (sequence) {
	const pending = pendingRequests[sequence];
	if (!pending) {
		return;
	}

	pending.reject(interceptors(pending.req, {error: 504, reason: 'Request Timeout'}));
	delete pendingRequests[sequence];
};

/**
 * Exports
 */
module.exports = exports = {
	...EventEmitter.prototype
};

const getDeviceScopedSequence = function (req) {
	return req.deviceid + '-' + req.sequence;
};

exports.postRequest = async function (req) {

	if (!validate(req)) {
		throw interceptors(req, {error: 400, reason: 'Bad Request'});
	}

	if (typeof methods[req.action] !== 'function') {
		throw interceptors(req, {
			error: 400,
			reason: 'Bad Request'
		});
	}

	if (req.action !== 'update' || utils.fromDevice(req)) {
		return methods[req.action](req);
	}

	// Update message from apps
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

	if (!device.online) {
		throw interceptors(req, {
			error: 503,
			reason: 'Device Offline'
		});
	}

	req.sequence = req.sequence || ('' + Date.now());
	exports.emit('app.update', req);

	return new Promise((resolve, reject) => {
		const deviceScopedSequence = getDeviceScopedSequence(req);
		pendingRequests[deviceScopedSequence] = {
			req: req,
			resolve: resolve,
			reject: reject,
			timer: setTimeout(removePendingRequest,
				config.pendingRequestTimeout || 3000,
				deviceScopedSequence)
		};
	});
};

exports.postResponse = function (res) {
	if (!res.sequence || !res.deviceid) {
		return;
	}

	const deviceScopedSequence = getDeviceScopedSequence(res);
	const pending = pendingRequests[deviceScopedSequence];

	if (!pending) {
		debug("response to req not found" + res.sequence);
		return;
	}

	clearTimeout(pending.timer);
	delete pendingRequests[deviceScopedSequence];

	if (!res.error) {
		methods.update(pending.req)
			.then(pending.resolve)
			.catch(pending.reject);
	} else {
		pending.reject(res);
	}

};

exports.notifyDeviceOnline = async function (deviceid, online) {


	const device = await Device.findOneAndUpdate({deviceid: deviceid}, {
		$set: {
			online: !!online,
		}
	});

	exports.emit('device.online', {
		action: 'sysmsg',
		deviceid: device.deviceid,
		apikey: device.apikey,
		params: {
			online: device.online
		}
	});

};

exports.deviceChange = (device) => {
	exports.emit('device.change', device);
};

exports.utils = utils;

methods.on('update', function (req) {
	exports.emit('device.update', req);
});
