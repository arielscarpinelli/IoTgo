angular.module('iotgo').
  filter('typeToImage', function () {
    var images = {
      'SWITCH': 'switch.png',
      'LIGHT': 'light.png',
      'THERMOSTAT': 'sensor-temperature-humidity.png'
      };

    return function (value) {
     return images[value] || images['custom.png'];
    };
  });