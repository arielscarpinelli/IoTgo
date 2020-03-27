angular.module('iotgo')
	.factory('User', ['$http', '$window', 'Settings', function ($http, $window, Settings) {
		let session;

		try {
			session = JSON.parse($window.sessionStorage.session);
		} catch (ignore) {}

		return {
			register: function (email, password, response, callback) {
				$http.post(Settings.httpServer + '/api/user/register',
					{email: email, password: password, response: response}).success(function (data) {
					if (data.error) {
						callback(data.error);
						return;
					}

					session = data;
					$window.sessionStorage.session = JSON.stringify(session);
					$window.sessionStorage.token = session.jwt;
					callback(undefined, session.user);
				}).error(function (data) {
					callback(data && data.error || 'Register user failed!');
				});
			},
			login: function (email, password, callback) {
				$http.post(Settings.httpServer + '/api/user/login', {email: email, password: password}).success(function (data) {
					if (data.error) {
						callback(data.error);
						return;
					}

					session = data;
					$window.sessionStorage.session = JSON.stringify(session);
					$window.sessionStorage.token = session.jwt;
					callback(undefined, session.user);
				}).error(function (data) {
					callback((data && data.error) || 'Log in failed!');
				});
			},
			sendPasswordResetEmail: function (email, callback) {
				$http.post(Settings.httpServer + '/api/user/password-reset-email', {email: email}).success(function (data) {
					if (data.error) {
						callback(data.error);
						return;
					}
					callback(null, data);
				}).error(function (data) {
					callback((data && data.error) || 'Recover password failed!');
				});
			},
			passwordReset: function (email, password, token, callback) {
				$http.post(Settings.httpServer + '/api/user/password-reset', {email: email, password: password, token: token}).success(function (data) {
					if (data.error) {
						callback(data.error);
						return;
					}
					session = data;
					$window.sessionStorage.session = JSON.stringify(session);
					$window.sessionStorage.token = session.jwt;
					callback(undefined, session.user);
				}).error(function (data) {
					callback((data && data.error) || 'Reset password failed!');
				});
			},
			logout: function () {
				session = undefined;
				$window.sessionStorage.session = undefined;
				$window.sessionStorage.token = undefined;
			},
			isLoggedIn: function () {
				return session ? true : false;
			},
			setPassword: function (oldPassword, newPassword, callback) {
				$http.post(Settings.httpServer + '/api/user/password',
					{oldPassword: oldPassword, newPassword: newPassword}).success(function (data) {
					if (data.error) {
						callback(data.error);
						return;
					}

					callback(undefined);
				}).error(function (data) {
					callback(data && data.error || 'Change password failed!');
				});
			},
			getUser: function () {
				return session ? session.user : {};
			},
			isActive: function () {
				var token = $window.sessionStorage.token;
				if (!token) {
					return false;
				}
				var info = token.substring(token.indexOf('.') + 1, token.lastIndexOf('.'));
				var decodedData = $window.atob(info);
				var json = JSON.parse(decodedData);
				return !!(json.isActivated);
			},
			isExpire: function () {
				var token = $window.sessionStorage.token;
				if (!token) {
					return false;
				}
				var info = token.substring(token.indexOf('.') + 1, token.lastIndexOf('.'));
				var decodedData = $window.atob(info);
				var json = JSON.parse(decodedData);
				if (!json.isActivated) {
					return Date.now() > new Date(json.validExpire).getTime();
				}
				return false;
			},
			activeAccount: function (callback) {
				$http.get('/api/user/activeAccount').success(function (data) {
					callback((data && data.message) || 'Check your email');
				}).error(function () {
					callback('Active Account failed,Please retry!');
				});
			},
			generateOAuthCode: function(redirectUri, clientId, callback) {
				$http.post('/api/oauth/code',
					{
						redirectUri,
						clientId
					}).success(function (data) {
						callback(null, data);
					}).error(function () {
					callback('failed');
				});
			}
		};
	}]);