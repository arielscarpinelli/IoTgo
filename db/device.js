/**
 * Dependencies
 */
const mongoose = require('mongoose');
const uuid = require('uuid');
const DeviceUpdate = require('./device-update');

/**
 * Private variables and functions
 */
const Schema = mongoose.Schema;

const now = function () {
	return new Date();
};

const empty = function () {
	return {};
};

/**
 * Exports
 */
var schema = new Schema({
	name: {type: String, required: true},
	group: {type: String, default: ''},
	type: {type: String, required: true, index: true},
	deviceid: {type: String, required: true, index: true, default: uuid.v4},
	apikey: {type: String, required: true, index: true},
	createdAt: {type: Date, index: true, default: now},
	updatedAt: {type: Date, default: now},
	online: {type: Boolean, index: true, default: false},
	params: {type: Schema.Types.Mixed, default: empty},
	attributes: {type: Schema.Types.Mixed, default: empty},
	traits: [String]
});

schema.statics.exists = function (apikey, deviceid) {
	return this.where({apikey: apikey, deviceid: deviceid}).findOne();
};

schema.statics.getDeviceByDeviceid = function (deviceid) {
	return this.where({deviceid: deviceid}).findOne();
};

schema.statics.getDevicesByApikey = function (apikey) {
	return this.where({apikey: apikey}).find();
};

schema.statics.getDefaultTraitsForType = function (type) {
	switch (type) {
		case "SWITCH":
			return ["OnOff"];
		case "LIGHT":
			return ["OnOff"];
		case "THERMOSTAT":
			return ["TemperatureSetting"];

	}
};

schema.statics.setOnline = function (deviceid, online) {
	return this.findOneAndUpdate(
		{deviceid: deviceid}, {
			$set: {
				online,
				updatedAt: now(),
			}
		}
		)
		.then(() => DeviceUpdate.record({
			deviceid,
			online
		}))
}

schema.pre('save', function () {
	this.paramsModified = this.isModified('params');
	this.updatedAt = now();
});

schema.post('save', function (doc) {
	if(!this.paramsModified) {
		require('../protocol').deviceChange(doc);
	}
	return DeviceUpdate.record(doc);
});

schema.post('remove', function (doc) {
	require('../protocol').deviceChange(doc);
});

module.exports = mongoose.model('Device', schema);