'use strict';

const { PostgresQueryInterface } = require('../postgres/query-interface');

class YugabyteQueryInterface extends PostgresQueryInterface{}

exports.YugabyteQueryInterface = YugabyteQueryInterface;
