'use strict';

const _ = require('lodash');

const Utils = require('../../utils');
const QueryTypes = require('../../query-types');
const Op = require('../../operators');
const { QueryInterface } = require('../abstract/query-interface');

/**
 * The interface that Sequelize uses to talk with MSSQL database
 */
class Db2QueryInterface extends QueryInterface {
  
}

exports.Db2QueryInterface = Db2QueryInterface;
