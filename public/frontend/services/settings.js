angular.module('iotgo')

.factory('Settings', [ '$location', function ($location) {
  var host = $location.host() + ':' + $location.port();

  return {
    httpServer: 'https://' + host,
    websocketServer: 'wss://' + host
  };
} ]);
