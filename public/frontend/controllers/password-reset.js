angular.module('iotgo').
  controller('PasswordResetCtrl', [ '$scope', '$window', '$location', 'User',
    function ($scope, $window, $location, User) {

      $scope.model = {};

      const search = $location.search();
      if (search.token && search.email) {
        $scope.model.email = search.email;
        $scope.model.token = search.token;
      }

      $scope.sendEmail = function () {
        User.sendPasswordResetEmail($scope.model.email, function (err, ok) {
          if (err) {
            $window.alert(err);
            return;
          }
          if (ok) {
            $window.alert("Check your email for instructions");
          }
        });
      };

      $scope.passwordReset = function () {
        User.passwordReset($scope.model.email, $scope.model.password, $scope.model.token, function (err, ok) {
          if (err) {
            $window.alert(err);
            return;
          }

          $location.path('/devices');
        });
      };
    }
  ]);