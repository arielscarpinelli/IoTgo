module.exports = {

	validationError(msg) {
		const error = new Error(msg);
		error.status = 400;
		return error;
	},

	notFoundError(msg) {
		const error = new Error(msg);
		error.status = 400;
		return error;
	},

	unauthorizedError(msg) {
		const error = new Error(msg);
		error.status = 401;
		return error;
	},
};