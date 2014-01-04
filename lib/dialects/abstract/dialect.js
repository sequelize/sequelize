var AbstractDialect = function() {
	
}

AbstractDialect.prototype.supports = {
	'RETURNING': false,
	'DEFAULT': true
}

module.exports = AbstractDialect