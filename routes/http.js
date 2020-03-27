/**
 * Dependencies
 */
const config = require('../config');
const protocol = require('../protocol/index');
const asyncHandler = require('express-async-handler');

module.exports = asyncHandler(async function (req, res) {

  if (req.header('Host') !== config.host ||
      req.header('Content-Type') !== 'application/json') {
    res.status(400).end();
    return;
  }

  const resBody = await protocol.postRequest(req.body);

  res.send(resBody);

});