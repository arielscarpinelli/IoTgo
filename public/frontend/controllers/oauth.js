angular.module('iotgo')
	.controller('OAuthCtrl', ['$scope', '$window', '$location', 'User',
		function ($scope, $window, $location, User) {
			const uri = $location.search().redirect_uri;
			const clientId = $location.search().client_id;
			User.generateOAuthCode(uri, clientId, (err, code) => {
				if (err) {
					alert(err);
					return;
				}

				const state = $location.search().state;
				window.location = uri + "?state=" + encodeURIComponent(state) + "&code=" + encodeURIComponent(code);
			})
		}
	]);