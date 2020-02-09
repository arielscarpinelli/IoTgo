angular.module('iotgo').
  filter('typeToHtml', function () {
    var types = {
      'SWITCH': 'switch.html',
      'LIGHT': 'light.html',
      'THERMOSTAT': 'sensor-temperature-humidity.html'
    };

    return function (value, path) {
      return path + (types[value] || 'custom.html');
    }
  });