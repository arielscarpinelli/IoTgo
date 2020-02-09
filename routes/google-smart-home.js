const express = require('express');

// Import the appropriate service
const {smarthome} = require('actions-on-google');

const {User, Device} = require('../db/index');

// Create an app instance
const app = smarthome();

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

// Register handlers for Smart Home intents

app.onExecute(async (body) => {
    const {requestId} = body;
    // Execution results are grouped by status
    const result = {
        ids: [],
        status: 'SUCCESS',
        states: {
            online: true,
        },
    };
    const executePromises = [];
    const intent = body.inputs[0];
    for (const command of intent.payload.commands) {
        for (const device of command.devices) {
            for (const execution of command.execution) {
                executePromises.push(
                    updateDevice(execution, device.id)
                        .then((data) => {
                            result.ids.push(device.id);
                            Object.assign(result.states, data);
                        })
                        .catch(() => console.error(`Unable to update ${device.id}`))
                );
            }
        }
    }
    await Promise.all(executePromises);
    return {
        requestId: requestId,
        payload: {
            commands: [result],
        },
    };
});

app.onQuery(async (body, headers) => {

    const payload = {
        devices: {},
    };
    const queryPromises = [];
    const intent = body.inputs[0];
    for (const device of intent.payload.devices) {
        const deviceId = device.id;
        queryPromises.push(Device.getDeviceByDeviceid(deviceId)
            .then((device) => {
                    // Add response to device payload
                    payload.devices[deviceId] = getDeviceState(device);
                }
            ));
    }

    await Promise.all(queryPromises);

    return {
        requestId: body.requestId,
        payload: payload,
    }
});

app.onSync(async (body, headers) => {

    const user = await getUserByAuthHeader(headers.authorization);
    console.log(user.apikey);
    const devices = await Device.getDevicesByApikey(user.apikey);

    return {
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
});

app.onDisconnect(async (body, headers) => {
    // TODO remove access tokens (?)
});

// TODO ReportState pushing updates
// TODO request sync when new device is added
