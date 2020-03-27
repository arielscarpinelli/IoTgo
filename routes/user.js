/**
 * Dependencies
 */
const express = require('express');
const expressJwt = require('express-jwt');
const jsonWebToken = require('jsonwebtoken');
const unless = require('express-unless');
const config = require('../config');
const db = require('../db/index');
const User = db.User;
const Device = db.Device;
const FactoryDevice = db.FactoryDevice;
const { httpsGet } = require('../lib/request-util');
const { sendMail } = require('../lib/email-util');
const pug = require('pug');
const uuid = require('uuid');
const path = require('path');
const asyncHandler = require('express-async-handler');
const { validationError, unauthorizedError } = require('../lib/errors');

/**
 * Private variables
 */
const recaptchaSecret = config.recaptcha.secret;
const recaptchaUrl = config.recaptcha.url;

const activatedAccountOnly = function (req, res, next) {
    const isActivated = req.user.isActivated;
    if (isActivated) {
        next();
    } else {
        const err = new Error('Activated Account only area!');
        err.status = 401;
        next(err);
    }
};

activatedAccountOnly.unless = unless;

/**
 * Exports
 */
module.exports = exports = express.Router();

const openPaths = ['/api/user/register', '/api/user/login', '/api/user/validate', '/api/user/password-reset-email', '/api/user/password-reset'];

// Enable Json Web Token
exports.use(expressJwt(config.jwt).unless({
    path: openPaths
}));

exports.use(activatedAccountOnly.unless({
    path: openPaths.concat(['/api/user/activeAccount'])
}));

const resetActivationTokenAndSendEmail = async function(email) {
    const token = uuid.v4();

    await User.resetToken(email, token);

    const html = pug.renderFile(path.join(__dirname, '../template/activeEmail.pug'), {
        user: {
            email: email,
            href: "https://" + config.host + '/api/user/validate?email=' + encodeURIComponent(email) + '&token=' + token
        }
    });

    return await sendMail({
        to: email,
        subject: 'iotMaster: Confirm Your Email Address',
        html: html
    });

};

// Registration
exports.route('/register').post(asyncHandler(async function (req, res) {
    const email = req.body.email;
    const password = req.body.password;
    if (!email || !password) {
        throw validationError('Email address and password must not be empty!');
    }

    // Google reCAPTCHA verification
    const response = req.body.response;
    if (!response) {
        throw validationError('reCAPTCHA verification is required!');
    }

    const url = recaptchaUrl +
        '?secret=' + recaptchaSecret +
        '&response=' + response;

    const recaptchaResult = await httpsGet(url);

    if (!recaptchaResult.success) {
        throw validationError('reCAPTCHA verification failed!');
    }

    const user = await User.register(email, password);

    await resetActivationTokenAndSendEmail(email);

    res.send({
        jwt: jsonWebToken.sign(user, config.jwt.secret, config.jwt.options),
        user: user
    });

}));

exports.route('/activeAccount').get(asyncHandler(async function (req, res) {
    const email = req.user.email;
    await resetActivationTokenAndSendEmail(email);

    res.send({message: 'Reset token success!'});
}));

exports.route('/validate').get(asyncHandler(async function (req, res) {
    const email = req.query.email;
    const token = req.query.token;

    if (!email || !token) {
        throw validationError('Email address and token must not be empty!');
    }

    const user = await User.activate(email, token);
    res.redirect('/login');

}));

exports.route('/password-reset-email').post(asyncHandler(async function (req, res) {
    const email = req.body.email;
    if (!email) {
        throw validationError('Email address must not be empty!');
    }

    const token = uuid.v4();
    await User.resetToken(email, token);

    const html = pug.renderFile(path.join(__dirname, '../template/passwordResetEmail.pug'), {
        user: {
            email: email,
            href: "https://" + config.host + '/password-reset?email=' + encodeURIComponent(email) + '&token=' + token
        }
    });

    await sendMail({
        to: email,
        subject: 'iotMaster: Password reset',
        html: html
    });

    res.send({message: 'Reset password email sent with success!'});

}));

exports.route('/password-reset').post(asyncHandler(async function (req, res) {
    const email = req.body.email;
    const newPassword = req.body.password;
    const token = req.body.token;
    if (!email || !token || typeof newPassword !== 'string' || !newPassword.trim()) {
        throw validationError('Email address, token and password must not be empty!');
    }

    const user = await User.resetPassword(email, newPassword, token);

    res.send({
        jwt: jsonWebToken.sign(user, config.jwt.secret, config.jwt.options),
        user: user
    });

}));

// Login
exports.route('/login').post(asyncHandler(async function (req, res) {
    const email = req.body.email;
    const password = req.body.password;
    if (!email || !password) {
        throw validationError('Email address and password must not be empty!');
    }

    const user = await User.authenticate(email, password);

    if(!user) {
        throw unauthorizedError( 'Email address or password is not correct!');
    }

    res.send({
        jwt: jsonWebToken.sign(user, config.jwt.secret, config.jwt.options),
        user: user
    });
}));

// Password management
exports.route('/password').post(asyncHandler(async function (req, res) {
    const email = req.user.email;

    const oldPassword = req.body.oldPassword;
    const newPassword = req.body.newPassword;

    if (typeof oldPassword !== 'string' || !oldPassword.trim() ||
        typeof newPassword !== 'string' || !newPassword.trim()) {
        throw validationError('Old password and new password must not be empty!');
    }

    const user = await User.authenticate(email, oldPassword);

    if (!user) {
        throw unauthorizedError( 'Old password is not correct!');
    }

    await User.setPassword(email, newPassword);

    res.send({message: "password updated"});

}));

// Device management
exports.route('/device').get(function (req, res) {
    Device.getDevicesByApikey(req.user.apikey, function (err, devices) {
        if (err || !devices.length) {
            res.send([]);
            return;
        }

        res.send(devices);
    });
}).post(function (req, res) {
    if (!req.body.name || !req.body.type) {
        res.send({
            error: 'Device name and type must be specified!'
        });
        return;
    }

    var device = {
        name: req.body.name,
        group: req.body.group,
        type: req.body.type,
        apikey: req.user.apikey,
        traits: req.body.traits || Device.getDefaultTraitsForType(req.body.type),
        attributes: req.body.attributes
    };

    (new Device(device)).save(function (err, device) {
        if (err) {
            res.send({
                error: 'Create device failed!'
            });
            return;
        }

        res.send(device);
    });

});

exports.route('/device/add').post(function (req, res) {
    var name = req.body.name;
    var apikey = req.body.apikey;
    var deviceid = req.body.deviceid;
    if ('string' !== typeof name || !name.trim() ||
        'string' !== typeof apikey || !apikey.trim() ||
        'string' !== typeof deviceid || !deviceid.trim()) {
        res.send({
            error: 'Device name, id and apikey must not be empty!'
        });
        return;
    }

    FactoryDevice.exists(apikey, deviceid, function (err, device) {
        if (err) {
            res.send({
                error: 'Add device failed!'
            });
            return;
        }

        if (!device) {
            res.send({
                error: 'Device does not exist!'
            });
            return;
        }

        Device.where('deviceid', deviceid).findOne(function (err, device) {
            if (err) {
                res.send({
                    error: 'Add device failed!'
                });
                return;
            }

            if (device) {
                res.send({
                    error: (device.apikey === req.user.apikey) ?
                        'Device has already been added!' : 'Device belongs to other user!'
                });
                return;
            }

            device = new Device({
                name: name,
                group: req.body.group ? req.body.group : '',
                type: deviceid.substr(0, 2),
                deviceid: deviceid,
                apikey: req.user.apikey
            });
            device.save(function (err, device) {
                if (err) {
                    res.send({
                        error: 'Add device failed!'
                    });
                    return;
                }

                res.send(device);
            });
        });
    });
});

exports.route('/device/:deviceid').get(function (req, res) {
    Device.exists(req.user.apikey, req.params.deviceid, function (err, device) {
        if (err || !device) {
            res.send({
                error: 'Device does not exist!'
            });
            return;
        }

        res.send(device);
    });
}).post(function (req, res) {
    if (typeof req.body.name !== 'string' ||
        typeof req.body.group !== 'string') {
        res.send({
            error: 'Device name and group must not be empty!'
        });
        return;
    }

    Device.exists(req.user.apikey, req.params.deviceid, function (err, device) {
        if (err || !device) {
            res.send({
                error: 'Device does not exist!'
            });
            return;
        }

        device.name = req.body.name;
        device.group = req.body.group;
        device.save(function (err, device) {
            if (err) {
                res.send({
                    error: 'Save device failed!'
                });
                return;
            }

            res.send(device);
        });
    });
}).delete(function (req, res) {
    Device.exists(req.user.apikey, req.params.deviceid, function (err, device) {
        if (err || !device) {
            res.send({
                error: 'Device does not exist!'
            });
            return;
        }

        device.remove(function (err, device) {
            if (err) {
                res.send({
                    error: 'Delete device failed!'
                });
            }

            res.send(device);
        });
    });
});


