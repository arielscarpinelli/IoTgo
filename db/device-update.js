/**
 * Dependencies
 */
const mongoose = require('mongoose');

const TTL = 25 * 30 * 24 * 3600; // 25 months

const normalizeDate = function (date) {
    const normalized = new Date(date);
    normalized.setUTCHours(0, 0, 0, 0);
    return normalized;
}

/**
 * Private variables and functions
 */
const Schema = mongoose.Schema;

const now = function () {
    return new Date();
};

const update = new Schema({
    online: {type: Boolean},
    params: {type: Schema.Types.Mixed},
    date: {type: Date, default: now},
});

/**
 * Exports
 */
var schema = new Schema({
    deviceid: {type: String, required: true},
    date: {type: Date, default: now},
    updates: [update]
});

schema.index({deviceid: 1, date: 1}, {unique: true});
schema.index({date: 1}, {expireAfterSeconds: TTL});

schema.statics.getUpdateHistoryByDeviceid = function (deviceid, from, to) {
    return this.where({deviceid: deviceid});
};

schema.statics.record = function (device) {
    const current = now();
    const normalized = normalizeDate(current);
    return this.updateOne(
        {deviceid: device.deviceid, date: normalized},
        {
            "$setOnInsert": {
                deviceid: device.deviceid,
                date: normalized,
            },
            "$push": {
                updates: [{
                    date: current,
                    params: device.params,
                    online: device.online
                }]
            }
        },
        {upsert: true});
}

schema.statics.findByDeviceIdAndDateRange = function (deviceid, from, to) {
    return this.find({
        deviceid: deviceid,
        date: {$gte: normalizeDate(from), $lte: normalizeDate(to)},
    }).then(r => {
        return r.reduce((acc, v) => {
            acc.updates = acc.updates.concat(v.updates.filter(update => {
                const d = Date.parse(update.date);
                return (from <= d) && (d <= to);
            }));
            return acc;
        }, {
            deviceid: deviceid,
            updates: []
        })
    });
}

module.exports = mongoose.model('DeviceUpdate', schema);