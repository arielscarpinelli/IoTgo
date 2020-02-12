const WebSocket = require('ws');

const HOST = process.env.HOST || "ws://localhost:3000/api/ws";
const DEVICE_ID = process.env.DEVICE_ID;
const APIKEY = process.env.APIKEY;

const state = {
    on: false
};

// TODO: read keyboard to switch the state

const ws = new WebSocket(HOST + "?deviceid=" + DEVICE_ID + "&apikey=" + APIKEY, {
    perMessageDeflate: false
});

const sendState = function () {
    console.debug(state);
    ws.send(JSON.stringify({
        action: 'update',
        deviceid: DEVICE_ID,
        apikey: APIKEY,
        params: state
    }))
};
ws.on('open', function open() {
    console.log('connected');
    sendState();
});

ws.on('close', function close() {
    console.log('disconnected');
});

ws.on('message', function incoming(msg) {
    console.log(msg);
    try {
        msg = JSON.parse(msg);
    }
    catch (err) {
        // Ignore non-JSON message
        return;
    }

    if (msg.action === "update") {
        state.on = msg.params.on;
        ws.send(JSON.stringify({
            error: 0,
            sequence: msg.sequence
        }));
    }
});

var stdin = process.openStdin();
stdin.on('data', function(chunk) {
    const str = "" + chunk;
    if (str === "on\n") {
        state.on = true;
        sendState();
    } else if (str === "off\n") {
        state.on = false;
        sendState();
    } else {
        console.log(str);
    }
});