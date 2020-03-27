const https = require('https');

module.exports.httpsGet = function (url) {
	return new Promise(function(resolve, reject) {
		var req = https.get(url, function(res) {
			// reject on bad status
			if (res.statusCode < 200 || res.statusCode >= 300) {
				return reject(new Error('statusCode=' + res.statusCode));
			}

			// cumulate data
			const body = [];
			res.on('data', function(chunk) {
				body.push(chunk);
			});

			// resolve on end
			res.on('end', function() {
				try {
					const jsonBody = JSON.parse(Buffer.concat(body).toString());
					resolve(jsonBody);
				} catch(e) {
					reject(e);
				}
			});
		});

		// reject on request error
		req.on('error', function(err) {
			// This is not a "Second reject", just a different sort of failure
			reject(err);
		});
		// IMPORTANT
		req.end();
	});
};
