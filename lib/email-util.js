const mailgunConf = require('../config').mailgun;
const mailgun = require('mailgun-js')({apiKey: mailgunConf.api_key, domain: mailgunConf.domain});
const debug = require('debug')('email-util');

exports.sendMail = async function (mailOptions) {

	const finalOptions = {
		...mailOptions,
		from: mailgunConf.from,
	};

	debug('mailOptions:', finalOptions);

	try {
		const result = await mailgun.messages().send(finalOptions);
		debug('Email Send success!');
		return result;
	} catch (error) {
		debug('err:', error);
		throw error;
	}

};