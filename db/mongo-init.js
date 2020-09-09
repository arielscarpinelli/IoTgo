db.createUser(
	{
		user: "iotgo",
		pwd: "iotgo",
		roles: [
			{
				role: "readWrite",
				db: "iotgo"
			}
		]
	}
);