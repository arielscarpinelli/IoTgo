/**
 * Dependencies
 */
const express = require('express');
const expressJwt = require('express-jwt');
const jsonWebToken = require('jsonwebtoken');
const unless = require('express-unless');
const config = require('../config');
const {User, Device, FactoryDevice} = require('../db/index');
const asyncHandler = require('express-async-handler');
const { validationError, unauthorizedError, notFoundError } = require('../lib/errors');

/**
 * Private variables and functions
 */
const adminOnly = function (req, res, next) {
    if (!req.user.isAdmin) {
        var err = new Error('Admin only area!');
        err.status = 401;
        next(err);
    }

    next();
};
adminOnly.unless = unless;

/**
 * Exports
 */
module.exports = exports = express.Router();

// Enable Json Web Token
exports.use(expressJwt(config.jwt).unless({
    path: ['/api/admin/login']
}));

// Restrict access to admin only
exports.use(adminOnly.unless({
    path: ['/api/admin/login']
}));

// Login
exports.route('/login').post(asyncHandler(async function (req, res) {
    const email = req.body.email;
    const password = req.body.password;
    if (!email || !password) {
        throw validationError('Email address and password must not be empty!');
    }

    if (!email in config.admin || config.admin[email] !== password) {
        throw new unauthorizedError('Email address or password is not correct!');
    }

    const user = {
        email,
        isAdmin: true
    };

    res.send({
        jwt: jsonWebToken.sign(user, config.jwt.secret),
        user
    });

}));

// User management
exports.route('/users').get(asyncHandler(async function (req, res) {
    const limit = Number(req.query.limit) || config.page.limit;
    const skip = Number(req.query.skip) || 0;

    const condition = {};
    if (req.query.createdAtFrom) {
        condition.createdAt = condition.createdAt ? condition.createdAt : {};
        condition.createdAt.$gte = new Date(req.query.createdAtFrom);
    }
    if (req.query.createdAtTo) {
        condition.createdAt = condition.createdAt ? condition.createdAt : {};
        condition.createdAt.$lte = new Date(req.query.createdAtTo);
    }

    const users = await User.find(condition).select('-password').skip(skip).limit(limit)
        .sort({createdAt: config.page.sort});

    res.send(users);

}));

exports.route('/users/:apikey').get(asyncHandler(async function (req, res) {
    const user = await User.findOne({'apikey': req.params.apikey}).select('-password');

    if (!user) {
        throw new notFoundError('User does not exist!');
    }
    res.send(user);

}));

exports.route('/users/:apikey').delete(asyncHandler(async function (req, res) {
    const user = await User.findOneAndRemove({'apikey': req.params.apikey});

    if (!user) {
        throw notFoundError('User does not exist!');
    }
        // Delete all devices belong to user
    await Device.remove({apikey: req.params.apikey});

    res.send(user);
}));

// Device management
exports.route('/devices').get(asyncHandler(async function (req, res) {
    const limit = Number(req.query.limit) || 0;
    const skip = Number(req.query.skip) || 0;

    const condition = {};
    if (req.query.createdAtFrom) {
        condition.createdAt = condition.createdAt || {};
        condition.createdAt.$gte = new Date(req.query.createdAtFrom);
    }
    if (req.query.createdAtTo) {
        condition.createdAt = condition.createdAt || {};
        condition.createdAt.$lte = new Date(req.query.createdAtTo);
    }
    if (req.query.name) {
        condition.name = new RegExp(req.query.name, 'i');
    }
    if (req.query.type) {
        condition.type = req.query.type;
    }
    if (req.query.deviceid) {
        condition.deviceid = new RegExp(req.query.deviceid, 'i');
    }
    if (req.query.apikey) {
        condition.apikey = req.query.apikey;
    }
    if (req.query.lastModifiedAtFrom) {
        condition.lastModified = condition.lastModified || {};
        condition.lastModified.$gte = new Date(req.query.lastModifiedAtFrom);
    }
    if (req.query.lastModifiedAtTo) {
        condition.lastModified = condition.lastModified || {};
        condition.lastModified.$lte = new Date(req.query.lastModifiedAtTo);
    }

    const devices = await Device.find(condition).select('-params').skip(skip).limit(limit)
        .sort({createdAt: config.page.sort});
    res.send(devices);
}));

exports.route('/devices/:deviceid').get(asyncHandler(async function (req, res) {
    const device = await Device.findOne({'deviceid': req.params.deviceid});
    if(!device) {
        throw new notFoundError('Device does not exist!');
    }
    res.send(device);
}));

// Factory device management
exports.route('/factorydevices').get(asyncHandler(async function (req, res) {
    const limit = Number(req.query.limit) || 0;
    const skip = Number(req.query.skip) || 0;

    const condition = {};
    if (req.query.createdAtFrom) {
        condition.createdAt = condition.createdAt || {};
        condition.createdAt.$gte = new Date(req.query.createdAtFrom);
    }
    if (req.query.createdAtTo) {
        condition.createdAt = condition.createdAt || {};
        condition.createdAt.$lte = new Date(req.query.createdAtTo);
    }
    if (req.query.name) {
        condition.name = new RegExp(req.query.name, 'i');
    }
    if (req.query.type) {
        condition.type = req.query.type;
    }
    if (req.query.deviceid) {
        condition.deviceid = new RegExp(req.query.deviceid, 'i');
    }
    if (req.query.apikey) {
        condition.apikey = req.query.apikey;
    }

    const factoryDevices = await FactoryDevice.find(condition).skip(skip).limit(limit)
        .sort({createdAt: config.page.sort})
        .exec();

    res.send(factoryDevices);
}));

exports.route('/factorydevices/create').post(asyncHandler(async function (req, res) {
    const name = req.body.name,
        type = req.body.type,
        qty = Number(req.body.qty),
        createdAt = new Date();

    if (!name || !name.trim() || !type || !type.trim()
        || 'number' !== typeof qty || 0 === qty) {
        throw new validationError('Factory device name, type and qty must not be empty!');
    }


    const promises = Array(qty)
        .map(() => new FactoryDevice({
            name: name,
            type: type,
            createdAt: createdAt
        }).save());

    const devices = await Promise.all(promises);

    /*
     if (req.query.file) {
     res.attachment(name + '-' + type + '-' + qty + '.csv');

     var download = [[ 'name', 'type', 'deviceid', 'apikey' ]];
     devices.forEach(function (device) {
     download.push([
     device.name, device.type, device.deviceid, device.apikey
     ]);
     });
     download.forEach(function (item, index) {
     download[index] = item.join(', ');
     });

     console.log(download.join('\r\n'));
     res.send(download.join('\r\n'));
     return;
     }
     */

    res.send(devices);
}));