var client = require('./client');
var pool = require('./pool');

exports.createClient = client.createClient;
exports.createTCPClient = client.createTCPClient;
exports.createUNIXClient = client.createUNIXClient;
exports.pool = pool.pool;
