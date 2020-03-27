/**
 * Dependencies
 */
const mongoose = require('mongoose');
const uuid = require('uuid');

/**
 * Private variables and functions
 */
const Schema = mongoose.Schema;

/**
 * Exports
 */
const schema = new Schema({
  name: { type: String, required: true },
  type: { type: String, required: true, index: true },
  deviceid: { type: String, required: true, index: true, default: uuid.v4 },
  apikey: { type: String, unique: true, default: uuid.v4 },
  createdAt: { type: Date, required: true }
});

schema.statics.exists = function (apikey, deviceid) {
  return this.where({ apikey: apikey, deviceid: deviceid }).findOne();
};

module.exports = mongoose.model('FactoryDevice', schema);