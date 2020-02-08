angular.module('iotgo')

.factory('Settings', [ '$location', function ($location) {
  var host = $location.host() + ':' + $location.port();
  let protocol = $location.protocol();

  return {
    httpServer: protocol + '://' + host,
    websocketServer: protocol.replace('http', 'ws') + '://' + host
  };
} ]);
