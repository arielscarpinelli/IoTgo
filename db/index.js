/**
 * Dependencies
 */
const User = require('./user');
const Device = require('./device');
const DeviceUpdate = require('./device-update');
const FactoryDevice = require('./factory-device');
const mongoose = require('mongoose');

/**
 * Exports
 */
module.exports = exports = mongoose;

exports.User = User;
exports.Device = Device;
exports.DeviceUpdate = DeviceUpdate;
exports.FactoryDevice = FactoryDevice;
