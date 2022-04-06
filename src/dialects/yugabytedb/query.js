'use strict';

const PostgresQuery = require('../postgres/query');

class Query extends PostgresQuery{}

module.exports = Query;
module.exports.Query = Query;
module.exports.default = Query;
