/**
 * Dependencies
 */
var mongoose = require('mongoose');
var uuid = require('uuid');
var protocol = require('../protocol');

/**
 * Private variables and functions
 */
var Schema = mongoose.Schema;

var now = function () {
  return new Date();
};

var empty = function () {
  return {};
};

/**
 * Exports
 */
var schema = new Schema({
  name: { type: String, required: true },
  group: { type: String, default: '' },
  type: { type: String, required: true, index: true },
  deviceid: { type: String, required: true, index: true, default: uuid.v4 },
  apikey: { type: String, required: true, index: true },
  createdAt: { type: Date, index: true, default: now },
  online: { type: Boolean, index: true, default: false },
  params: { type: Schema.Types.Mixed, default: empty },
  attributes: { type: Schema.Types.Mixed, default: empty },
  traits: [ String ]
});

schema.static('exists', function (apikey, deviceid, callback) {
  return this.where({ apikey: apikey, deviceid: deviceid }).findOne(callback);
});

schema.static('getDeviceByDeviceid', function (deviceid, callback) {
  return this.where({ deviceid: deviceid }).findOne(callback);
});

schema.static('getDevicesByApikey', function (apikey, callback) {
  return this.where('apikey', apikey).find(callback);
});

schema.static('getDefaultTraitsForType', function (type) {
  switch(type) {
    case "SWITCH":
      return ["OnOff"];
    case "LIGHT":
      return ["OnOff"];
    case "THERMOSTAT":
      return ["TemperatureSetting"];

  }
});

schema.post('save', function(doc) {
  protocol.deviceChange(doc);
});

schema.post('remove', function(doc) {
  protocol.deviceChange(doc);
});

module.exports = mongoose.model('Device', schema);