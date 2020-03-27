/**
 * Dependencies
 */
const config = require('../config');
const express = require('express');
const expressJwt = require('express-jwt');
const jsonWebToken = require('jsonwebtoken');
const {User} = require('../db/index');
const asyncHandler = require('express-async-handler');
const debug = require('debug')('oauth');

module.exports = exports = express.Router();

const findOAuthClientConfig = (request) => {
	const clientId = request.query.client_id
		? request.query.client_id : request.body.client_id;

	return Object.keys(config.oauth)
		.map(provider =>
			Object.assign({
				provider
			}, config.oauth[provider])
		)
		.find(oauthConfig => (oauthConfig.clientId === clientId));
};

const unauthorized = function (res, error, desc) {
	debug(error);
	if (desc) {
		debug(desc);
	}
	res.status(401)
		.json({
			error: error
		});
};

exports.route('/auth').get((request, response) => {

	const oauthClientConfig = findOAuthClientConfig(request);

	if (!oauthClientConfig) {
		return unauthorized(res, "Invalid client_id");
	}

	if (request.query.response_type !== 'code') {
		return unauthorized(res, "Invalid response_type");
	}

	return response.redirect('/oauth?client_id=' + oauthClientConfig.clientId + '&provider=' + oauthClientConfig.provider + '&redirect_uri=' + request.query.redirect_uri + '&state=' + request.query.state);
});


exports.route('/code').post(expressJwt(config.jwt), (req, res) => {

	res.send(jsonWebToken.sign({
		redirectUri: req.body.redirectUri,
		clientId: req.body.clientId,
		apikey: req.user.apikey
	}, config.jwt.secret, config.jwt.options))

});

const generateAccessToken = function (oauthClientConfig, apiKey, expiresIn) {
	return jsonWebToken.sign({
		clientId: oauthClientConfig.clientId,
		apikey: apiKey
	}, config.jwt.secret, {
		expiresIn
	});
};

exports.route('/token').post(asyncHandler(async (req, res) => {
	const grantType = req.query.grant_type
		? req.query.grant_type : req.body.grant_type;
	const secondsInDay = 86400; // 60 * 60 * 24

	const oauthClientConfig = findOAuthClientConfig(req);

	const clientSecret = req.query.client_secret
		? req.query.client_secret : req.body.client_secret;

	if (!oauthClientConfig || oauthClientConfig.clientSecret !== clientSecret) {
		return unauthorized(res, "Invalid client_id or client_secret");
	}

	let obj;
	if (grantType === 'authorization_code') {

		const code = req.query.code
			? decodeURIComponent(req.query.code) : req.body.code;

		const redirectUri = req.query.redirect_uri
			? decodeURIComponent(req.query.redirect_uri) : req.body.redirect_uri;

		const decoded = jsonWebToken.verify(code, config.jwt.secret, config.jwt);

		if (decoded.redirectUri !== redirectUri) {
			return unauthorized(res, "Invalid redirect_uri");
		}

		if (decoded.clientId !== oauthClientConfig.clientId) {
			return unauthorized(res, "Invalid code");
		}

		const apiKey = decoded.apikey;

		const refreshToken = jsonWebToken.sign({
			clientId: oauthClientConfig.clientId,
			apikey: apiKey
		}, config.jwt.secret);

		try {
			await User.setOAuthRefreshToken(apiKey, oauthClientConfig.provider, refreshToken);

			const accessToken = generateAccessToken(oauthClientConfig, apiKey, secondsInDay);

			obj = {
				token_type: 'bearer',
				access_token: accessToken,
				refresh_token: refreshToken,
				expires_in: secondsInDay,
			};
		} catch (err) {
			return unauthorized(res, "Invalid user", err);
		}

	} else if (grantType === 'refresh_token') {

		const refreshToken = req.query.refresh_token
			? decodeURIComponent(req.query.refresh_token) : req.body.refresh_token;

		const error = "Invalid token";
		try {
			const user = await User.findByOAuthRefreshToken(oauthClientConfig.provider, refreshToken);

			const decoded = jsonWebToken.verify(refreshToken, config.jwt.secret, config.jwt);

			if (decoded.apikey !== user.apikey) {
				return unauthorized(res, error, "apikey");
			}

			if (decoded.clientId !== oauthClientConfig.clientId) {
				return unauthorized(res, error, "clientId");
			}

			obj = {
				token_type: 'bearer',
				access_token: generateAccessToken(oauthClientConfig, user.apikey, secondsInDay),
				expires_in: secondsInDay,
			};
		} catch (err) {
			return unauthorized(res, error, err);
		}
	} else {
		return unauthorized(res, "Invalid grant_type");
	}

	res.json(obj);
}));