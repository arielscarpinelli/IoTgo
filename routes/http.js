/**
 * Dependencies
 */
const config = require('../config');
const protocol = require('../protocol/index');
const asyncHandler = require('express-async-handler');

module.exports = asyncHandler(async function (req, res) {

  try {
	  const resBody = await protocol.postRequest(req.body);
	  res.send(resBody);
  } catch (e) {
  	const err = new Error(e.reason);
  	err.status = e.error;
  }

});