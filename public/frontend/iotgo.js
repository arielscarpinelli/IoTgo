angular.module('iotgo', ['ngRoute', 'ngResource', 'gRecaptcha', 'angular-carousel'])
	.run(['$rootScope', '$location', 'User', function ($rootScope, $location, User) {
		$rootScope.$on("$routeChangeStart", function (event, next, current) {
			if (next.authenticate && !User.isLoggedIn()) {
				let returnTo = $location.url();
				$location.url('/login');
				$location.search('returnTo', returnTo);
			}
		});
	}])
	.config(['$routeProvider', '$locationProvider', '$httpProvider',
		function ($routeProvider, $locationProvider, $httpProvider) {
			$routeProvider.when('/', {
				templateUrl: '/views/index.html',
				controller: 'IndexCtrl'
			}).when('/login', {
				templateUrl: '/views/login.html',
				controller: 'LoginCtrl'
			}).when('/password-reset', {
				templateUrl: '/views/password-reset.html',
				controller: 'PasswordResetCtrl'
			}).when('/signup', {
				templateUrl: '/views/signup.html',
				controller: 'SignupCtrl'
			}).when('/profile', {
				templateUrl: '/views/profile.html',
				controller: 'ProfileCtrl',
				authenticate: true
			}).when('/devices', {
				templateUrl: '/views/devices.html',
				controller: 'DevicesCtrl',
				authenticate: true
			}).when('/oauth', {
				template: '',
				controller: 'OAuthCtrl',
				authenticate: true
			}).otherwise({
				redirectTo: '/'
			});

			$locationProvider.html5Mode({
				enabled: true,
				requireBase: false
			});

			$httpProvider.interceptors.push('authInterceptor');
		}
	]);