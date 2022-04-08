'use strict';

const util = require('util');
const _ = require('lodash');
const Utils = require('../../utils');
const Model = require('../../model');

const PostgresQueryGenerator = require('../postgres/query-generator');

class YugabyteQueryGenerator extends PostgresQueryGenerator{}

module.exports = YugabyteQueryGenerator;
