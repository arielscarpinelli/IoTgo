const express = require('express');

// Import the appropriate service
const {smarthome} = require('actions-on-google');

const {User, Device} = require('../db/index');

const protocol = require('../protocol/index');

var config = require('../config');

var uuid = require('uuid');

// Create an app instance
const app = smarthome({
    jwt: config.smarthomejwt
});

module.exports = exports = express.Router();

module.exports.route('/fulfillment')
    .post(app)
    .all(function (req, res) {
        res.send(405).end();
    });

const getUserByAuthHeader = (authHeader) => {
    const token = (authHeader || "").substr(7);

    // TODO validate non-expired token

    return User.findByOAuthToken(token);

};

const validateAccessToken = async (req, res, next) => {

    const user = await getUserByAuthHeader(req.header("Authorization"));

    if (user) {
        req.user = user;
        next();
    } else {
        var err = new Error('Invalid token');
        err.status = 401;
        next(err);
    }
};

exports.use(validateAccessToken);


const getDeviceState = (device) => {
    return {
        online: device.online,
        ...device.params
    };
};

const getGoogleDeviceType = (type) => {
    return "action.devices.types." + type;
};

const getGoogleTrait = (trait) => {
    return "action.devices.traits." + trait;
};


const updateDevice = (execution, apikey, deviceid) => {

    // TODO: we should check the command and filter/translate the params...

    return protocol.postRequest({
        action: 'update',
        params: execution.params,
        deviceid: deviceid,
        apikey: apikey,
        userAgent: 'google'
    }).then(res => {
        return {
            params: res.params || execution.params
        }
    })
};

// Register handlers for Smart Home intents

app.onExecute(async (body, headers) => {

    const user = await getUserByAuthHeader(headers.authorization);

    const {requestId} = body;
    // Execution results are grouped by status

    const commands = [];

    const executePromises = [];
    const intent = body.inputs[0];
    for (const command of intent.payload.commands) {
        for (const device of command.devices) {
            for (const execution of command.execution) {
                executePromises.push(
                    updateDevice(execution, user.apikey, device.id)
                        .then((data) => {
                            commands.push({
                                ids: [device.id],
                                status: 'SUCCESS',
                                states: {
                                    online: true,
                                    ...data.params
                                },
                            });
                        })
                        .catch((err) => {
                            if (err && err.error === 503) {
                                commands.push({
                                    ids: [device.id],
                                    status: 'OFFLINE'
                                })
                            } else {
                                commands.push({
                                    ids: [device.id],
                                    status: 'ERROR',
                                    errorCode: err && (err.reason || err.error)
                                })
                            }
                        })
                );
            }
        }
    }
    await Promise.all(executePromises);

    const result = {
        requestId: requestId,
        payload: {
            commands: commands,
        },
    };

    console.debug(JSON.stringify(result, null, 4));

    return result;
});

app.onQuery(async (body, headers) => {

    const user = await getUserByAuthHeader(headers.authorization);

    const payload = {
        devices: {},
    };
    const queryPromises = [];
    const intent = body.inputs[0];
    for (const device of intent.payload.devices) {
        const deviceId = device.id;
        queryPromises.push(Device.exists(user.apikey, deviceId)
            .then((device) => {
                    // Add response to device payload
                    payload.devices[deviceId] = getDeviceState(device);
                }
            ));
    }

    await Promise.all(queryPromises);

    const result = {
        requestId: body.requestId,
        payload: payload,
    };

    console.debug(JSON.stringify(result, null, 4));

    return result
});

app.onSync(async (body, headers) => {

    const user = await getUserByAuthHeader(headers.authorization);
    const devices = await Device.getDevicesByApikey(user.apikey);

    const result = {
        requestId: body.requestId,
        payload: {
            agentUserId: user.apikey,
            devices: devices.map(device => {
                return {
                    id: device.deviceid,
                    type: getGoogleDeviceType(device.type),
                    traits: device.traits.map(getGoogleTrait),
                    attributes: device.attributes,
                    name: {
                        name: device.name,
                    },
                    willReportState: true
                }
            })
        },
    };

    console.debug(JSON.stringify(result, null, 4));

    return result;
});

app.onDisconnect(async (body, headers) => {
    // TODO remove access tokens (?)
});

protocol.on('device.update', async function (req) {

    const requestBody = {
        requestId: uuid.v4(), /* Any unique ID */
        agentUserId: req.apikey, /* Hardcoded user ID */
        payload: {
            devices: {
                states: {
                    /* Report the current state of our washer */
                    [req.deviceid]: {
                        ...req.params
                    },
                },
            },
        },
    };

    console.debug("Report state: ", JSON.stringify(requestBody, null, 4));

    const res = await app.reportState(requestBody);
    console.info('Report state response:', res);

});

protocol.on('device.change', async function (req) {

    const res = await app.requestSync(req.apikey);

    console.info('Request sync ' + req.apikey + ':', res);
});
