/**
 * Dependencies
 */
var uuid = require('uuid');
var bcrypt = require('bcrypt');
var mongoose = require('mongoose');

/**
 * Private variables and functions
 */
var Schema = mongoose.Schema;
var hash = function (value) {
  return bcrypt.hashSync(value, 10);
};
var transform = function (doc, ret) {
  delete ret.password;
  delete ret.token;
  delete ret.__v;
  return ret;
};
var now = function () {
  return new Date();
};
var ACTIVE_TIME = 24 * 60 * 60 * 1000;


/**
 * Exports
 */


var oauthTokenSchema = new Schema({
	refreshToken: {type: String, index: true},
	provider: {type: String},
});

var schema = new Schema({
  email: {type: String, required: true, unique: true},
  password: {type: String, required: true, set: hash},
  apikey: {type: String, unique: true, default: uuid.v4},
  createdAt: {type: Date, index: true, default: now},
  isActivated: {type: Boolean, default: false},
  token: {type: String},
  validExpire: {type: Date},
  oAuthTokens: [oauthTokenSchema]
});

schema.static('register', function (email, password, callback) {
  this.create({email: email, password: password}, function (err, user) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, user.toObject({transform: transform}));
  });
});

schema.static('resetToken', function (email, token, callback) {
  var that = this;
  that.findOne({email: email}, function (err, user) {
    if (err) {
      return callback(err);
    }

    if (!user) {
      return callback(null, null, 'The user does not exist!');
    }

    if (user.isActivated) {
      return callback(null, null, 'The user has activated, no active again!');
    }

    that.findOneAndUpdate({email: email}, {
      $set: {
        token: token,
        validExpire: Date.now() + ACTIVE_TIME
      }
    }, function (err, user) {
      if (err) {
        return callback(err);
      }

      callback(null, user.toObject({transform: transform}), 'Reset token success!');
    });
  });
});

schema.static('active', function (email, token, callback) {
  var that = this;

  that.findOne({email: email}, function (err, user) {
    if (err) {
      return callback(err);
    }

    if (!user) {
      return callback(null, null, 'The user does not exist!');
    }

    if (user.isActivated) {
      return callback(null, null, 'The user has activated, no active again!');
    }

    if (!user.validExpire || !user.token) {
      return callback(null, null, 'Illegal request!');
    }

    if (user.validExpire && user.validExpire < Date.now()) {
      return callback(null, null, 'Activation time has expired, please re-activate!');
    }

    if (user.token && user.token !== token) {
      return callback(null, null, 'Illegal token!');
    }

    that.findOneAndUpdate({email: email}, {
      $set: {isActivated: true},
      $unset: {validExpire: 1, token: 1}
    }, function (err, user) {
      if (err) {
        return callback(err);
      }

      callback(null, user, 'User activation is successful!')
    });
  });
});

schema.static('authenticate', function (email, password, callback) {
  this.where('email', email).findOne(function (err, user) {
    if (err) {
      callback(err);
      return;
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      callback(null, false);
      return;
    }

    callback(null, user.toObject({transform: transform}));
  });
});

schema.static('setPassword', function (email, password, callback) {
  this.where('email', email).findOne(function (err, user) {
    if (err) {
      callback(err);
      return;
    }

    if (!user) {
      callback('User does not exist!');
      return;
    }

    user.password = password;
    user.save(function (err, user) {
      if (err) {
        callback(err);
        return;
      }

      callback(null, user.toObject({transform: transform}))
    });
  });
});

schema.static('setOAuthRefreshToken', async function (apikey, provider, refreshToken) {

	const user = await this.where('apikey', apikey).findOne();

	if (!user) {
		throw new Error('User does not exist!');
	}

	const existing = user.oAuthTokens.find(token => token.provider === provider);

	if (existing) {
		existing.refreshToken = refreshToken;
	} else {
		user.oAuthTokens.push({
			provider,
			refreshToken
		});
	}

	return user.save();

});

schema.static('findByOAuthRefreshToken', async function (provider, refreshToken) {
  return this.findOne({
	'oAuthTokens.refreshToken': refreshToken,
	'oAuthTokens.provider': provider
  });
});

module.exports = mongoose.model('User', schema);