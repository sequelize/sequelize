'use strict';

const AbstractQuery = require('../abstract/query');
const MariaDBQuery = require('../mariadb/query');

class Query extends MariaDBQuery {}

Query.outputName = 'MySQL';
Query.prototype.handleShowTablesQuery = AbstractQuery.prototype.handleShowTablesQuery;
Query.prototype.handleJsonSelectQuery = () => {};

module.exports = Query;
