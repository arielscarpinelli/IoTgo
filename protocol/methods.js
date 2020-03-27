/**
 * Dependencies
 */
var db = require('../db/index');
var Device = db.Device;
var FactoryDevice = db.FactoryDevice;
var validate = require('./types');
var interceptors = require('./interceptors');
var EventEmitter = require('events').EventEmitter;

/**
 * Exports
 */
module.exports = exports = {
  ...EventEmitter.prototype
};

exports.register = function (req, callback) {
  FactoryDevice.exists(req.apikey, req.deviceid, function (err, device) {
    if (err || ! device) {
      callback(interceptors(req, {
        error: 403,
        reason: 'Forbidden'
      }));
      return;
    }

    Device.getDeviceByDeviceid(req.deviceid, function (err, device) {
      if (err || ! device) {
        callback(interceptors(req, {
          error: 404,
          reason: 'Not Found'
        }));
        return;
      }

      callback(interceptors(req, {
        error: 0,
        apikey: device.apikey
      }));
    });
  });
};

exports.update = function (req, callback) {
  if (typeof req.params !== 'object' || ! validate(req)) {
    callback(interceptors(req, {
      error: 400,
      reason: 'Bad Request'
    }));
    return;
  }

  Device.exists(req.apikey, req.deviceid, function (err, device) {
    if (err || ! device) {
      callback(interceptors(req, {
        error: 403,
        reason: 'Forbidden'
      }));
      return;
    }

    const reqParams = req.params;

    device.params = {
      ...device.params,
      reqParams
    };

    device.markModified('params');
    if (req.params.timers) {
      device.markModified('params.timers');
    }
    device.save();
    callback(interceptors(req, {
      error: 0,
      params: device.params
    }));

    exports.emit('update', req);
  });
};

exports.query = function (req, callback) {

  Device.exists(req.apikey, req.deviceid, function (err, device) {
    if (err || ! device) {
      callback(interceptors(req, {
        error: 403,
        reason: 'Forbidden'
      }));
      return;
    }

    if (!req.params || !req.params.length) {
      callback(interceptors(req, {
        error: 0,
        params: device.params
      }));
      return;
    }

    var params = {};
    req.params.forEach(function (item) {
      if (item in device.params) {
        params[item] = device.params[item];
      }
    });
    callback(interceptors(req, {
      error: 0,
      params: params
    }));
  });
};

exports.date = function (req, callback) {
  callback(interceptors(req, {
    error: 0,
    date: (new Date()).toISOString()
  }));
};
