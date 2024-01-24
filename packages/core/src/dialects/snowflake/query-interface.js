'use strict';

const { AbstractQueryInterface } = require('../abstract/query-interface');

/**
 * The interface that Sequelize uses to talk with Snowflake database
 */
export class SnowflakeQueryInterface extends AbstractQueryInterface {}
