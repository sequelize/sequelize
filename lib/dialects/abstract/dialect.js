var AbstractDialect = function() {
	
}

AbstractDialect.prototype.supports = {
	'RETURNING': false,
	'DEFAULT': true,
	'DEFAULT VALUES': false
}

module.exports = AbstractDialect