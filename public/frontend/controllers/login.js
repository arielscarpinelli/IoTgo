angular.module('iotgo').
  controller('LoginCtrl', [ '$scope', '$window', '$location', 'User',
    function ($scope, $window, $location, User) {

      if (($location.search().returnTo || '').startsWith('/oauth')) {
        $scope.oauth = true;
      }

      $scope.login = function () {
        User.login($scope.email, $scope.password, function (err, user) {
          if (err) {
            $window.alert(err);
            return;
          }

          if ($location.search().returnTo) {
            $location.url($location.search().returnTo);
          } else {
            $location.path('/devices');
          }
        });
      };
    }
  ]);