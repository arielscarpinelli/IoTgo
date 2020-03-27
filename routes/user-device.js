const express = require('express');
const {Device, FactoryDevice} = require('../db/index');
const asyncHandler = require('express-async-handler');
const {validationError, notFoundError} = require('../lib/errors');

module.exports = exports = express.Router();

// Device management
exports.route('/').get(asyncHandler(async function (req, res) {
	res.send(await Device.getDevicesByApikey(req.user.apikey));
}));

exports.route('/').post(asyncHandler(async function (req, res) {

	if (!req.body.name || !req.body.type) {
		throw new validationError('Device name and type must be specified!');
	}

	const device = new Device({
		name: req.body.name,
		group: req.body.group,
		type: req.body.type,
		apikey: req.user.apikey,
		traits: req.body.traits || Device.getDefaultTraitsForType(req.body.type),
		attributes: req.body.attributes
	});

	const saved = await device.save();

	res.send(saved);

}));

exports.route('/add').post(asyncHandler(async function (req, res) {

	const name = req.body.name;
	const apikey = req.body.apikey;
	const deviceid = req.body.deviceid;

	if ('string' !== typeof name || !name.trim() ||
		'string' !== typeof apikey || !apikey.trim() ||
		'string' !== typeof deviceid || !deviceid.trim()) {
		throw new validationError('Device name, id and apikey must not be empty!');
	}

	const factoryDevice = await FactoryDevice.exists(apikey, deviceid);

	if (!factoryDevice) {
		throw new notFoundError('Device does not exist!');
	}

	const existing = await Device.getDeviceByDeviceid(deviceid);

	if (existing) {
		throw new validationError((device.apikey === req.user.apikey) ?
			'Device has already been added!' : 'Device belongs to other user!');
	}

	const device = new Device({
		name: name,
		group: req.body.group ? req.body.group : '',
		type: deviceid.substr(0, 2),
		deviceid: deviceid,
		apikey: req.user.apikey
	});

	const savedDevice = await device.save();

	res.send(savedDevice);

}));

exports.route('/:deviceid').get(asyncHandler(async function (req, res) {
	const device = await Device.exists(req.user.apikey, req.params.deviceid);

	if (!device) {
		throw notFoundError('Device does not exist!');
	}

	res.send(device);

}));

exports.route('/:deviceid').post(asyncHandler(async function (req, res) {
	if (typeof req.body.name !== 'string' ||
		typeof req.body.group !== 'string') {
		throw new validationError('Device name and group must not be empty!');
	}

	const device = await Device.exists(req.user.apikey, req.params.deviceid);

	if (!device) {
		throw new notFoundError('Device does not exist!');
	}

	device.name = req.body.name;
	device.group = req.body.group;

	const updatedDevice = await device.save();

	res.send(updatedDevice);

}));

exports.route('/:deviceid').delete(asyncHandler(async function (req, res) {

	const device = Device.exists(req.user.apikey, req.params.deviceid);

	if (!device) {
		throw new notFoundError('Device does not exist!');
	}

	const removed = await device.remove();

	res.send(removed);

}));
