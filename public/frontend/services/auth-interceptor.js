angular.module('iotgo').
  factory('authInterceptor', ['$window', '$location', function ($window, $location) {
      return {
        request: function (config) {
          config.headers = config.headers || {};
          if ($window.sessionStorage.token) {
            config.headers.Authorization = 'Bearer ' + $window.sessionStorage.token;
          }
          return config;
        },
        response: function (response) {
          if (response.status === 401) {
            $location.path('/login?returnTo=' + encodeURIComponent($location.path()));
            return;
          }

          return response;
        }
      }
    } ]);