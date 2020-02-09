/**
 * Dependencies
 */
var mongoose = require('mongoose');
var uuid = require('uuid');

/**
 * Private variables and functions
 */
var Schema = mongoose.Schema;

/**
 * Exports
 */
var schema = new Schema({
  name: { type: String, required: true },
  type: { type: String, required: true, index: true },
  deviceid: { type: String, required: true, index: true, default: uuid.v4 },
  apikey: { type: String, unique: true, default: uuid.v4 },
  createdAt: { type: Date, required: true }
});

schema.static('exists', function (apikey, deviceid, callback) {
  this.where({ apikey: apikey, deviceid: deviceid }).findOne(callback);
});


module.exports = mongoose.model('FactoryDevice', schema);