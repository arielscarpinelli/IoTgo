/**
 * Dependencies
 */
const uuid = require('uuid');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { validationError, notFoundError } = require('../lib/errors');

/**
 * Private variables and functions
 */
const Schema = mongoose.Schema;

const hash = (value) => bcrypt.hashSync(value, 10);

const transform = function (doc, ret) {
	delete ret.password;
	delete ret.token;
	delete ret.__v;
	return ret;
};

const userToObject = (user) =>
	user.toObject({transform});

const now = () => new Date();

const TOKEN_EXPIRATION_TIME = 24 * 60 * 60 * 1000;


/**
 * Exports
 */
const oauthTokenSchema = new Schema({
	refreshToken: {type: String, index: true},
	provider: {type: String},
	createdAt: {type: Date}
});

const userSchema = new Schema({
	email: {type: String, required: true, unique: true},
	password: {type: String, required: true, set: hash},
	apikey: {type: String, unique: true, default: uuid.v4},
	createdAt: {type: Date, index: true, default: now},
	isActivated: {type: Boolean, default: false},
	token: {type: String},
	validExpire: {type: Date},
	oAuthTokens: [oauthTokenSchema]
});

userSchema.statics.register = async function (email, password) {

	if (password.length < 8) {
		throw validationError('Password too short, must be 8 chars long');
	}

	const user = await this.findOne({email: email});

	if (user) {
		throw validationError('Email address already registered');
	}

	return userToObject(await this.create({email: email, password: password}));
};

userSchema.statics.resetToken = async function (email, token) {

	const user = await this.findOne({email: email});

	if (!user) {
		throw notFoundError('The user does not exist!');
	}

	const updatedUser = await this.findOneAndUpdate({email: email}, {
		$set: {
			token: token,
			validExpire: Date.now() + TOKEN_EXPIRATION_TIME
		}
	});

	return userToObject(updatedUser);

};

userSchema.statics.activate = async function (email, token) {

	const user = await this.findOne({email: email});

	if (!user) {
		throw notFoundError('The user does not exist!');
	}

	if (user.isActivated) {
		throw validationError('The user is already activated');
	}

	if (!user.validExpire || !user.token) {
		throw validationError('No token')
	}

	if (user.validExpire && user.validExpire < Date.now()) {
		throw validationError('Activation time has expired, please re-activate!');
	}

	if (user.token !== token) {
		throw validationError('Token mismatch!');
	}

    const updatedUser = await this.findOneAndUpdate({email: email}, {
      $set: {isActivated: true},
      $unset: {validExpire: 1, token: 1}
    });

	return userToObject(updatedUser);
};

userSchema.statics.authenticate = async function (email, password) {

	const user = await this.findOne({email: email});

	if (!user || !bcrypt.compareSync(password, user.password)) {
		return false;
	}

	return userToObject(user);
};

userSchema.statics.setPassword = async function (email, password) {

	if (password.length < 8) {
		throw validationError('Password too short, must be 8 chars long');
	}

	const user = await this.findOne({email: email});

	if (!user) {
		throw notFoundError('User does not exist!');
	}

	user.password = password;

	const updatedUser = await user.save();

	return userToObject(updatedUser);
};

userSchema.statics.setOAuthRefreshToken = async function (apikey, provider, refreshToken) {

	const user = await this.findOne({apikey: apikey});

	if (!user) {
		throw notFoundError('User does not exist!');
	}

	const existing = user.oAuthTokens.find(token => token.provider === provider);

	if (existing) {
		existing.refreshToken = refreshToken;
		existing.createdAt = now();
	} else {
		user.oAuthTokens.push({
			provider,
			refreshToken,
			createdAt: now()
		});
	}

	const updatedUser = await user.save();

	return userToObject(updatedUser);

};

userSchema.statics.findByOAuthRefreshToken = function (provider, refreshToken) {
	return this.findOne({
		'oAuthTokens.refreshToken': refreshToken,
		'oAuthTokens.provider': provider
	});
};

userSchema.statics.resetPassword = async function (email, password, token) {

	if (password.length < 8) {
		throw validationError('Password too short, must be 8 chars long');
	}

	const user = await this.findOne({email: email});

	if (!user) {
		throw notFoundError('User does not exist!');
	}

	if (!user.validExpire || !user.token) {
		throw validationError('Password reset link already used')
	}

	if (user.validExpire && user.validExpire < Date.now()) {
		throw validationError('Password reset time has expired, please create a new request!');
	}

	if (user.token !== token) {
		throw validationError('Token mismatch!');
	}


	user.password = password;
	user.token = null;
	user.validExpire = null;

	const updatedUser = await user.save();

	return userToObject(updatedUser);

};

module.exports = mongoose.model('User', userSchema);