
/**
 * Exports
 */
module.exports = exports = {};

exports.fromDevice = function (req) {
  return typeof req.userAgent === 'undefined' || req.userAgent === 'device';
};

