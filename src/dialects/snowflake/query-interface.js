'use strict';

import { assertNoReservedBind, combineBinds } from '../../utils/sql';

const sequelizeErrors = require('../../errors');
const { AbstractQueryInterface } = require('../abstract/query-interface');
const { QueryTypes } = require('../../query-types');

/**
 * The interface that Sequelize uses to talk with Snowflake database
 */
export class SnowflakeQueryInterface extends AbstractQueryInterface {
  /** @override */
  async upsert(tableName, insertValues, updateValues, where, options) {
    if (options.bind) {
      assertNoReservedBind(options.bind);
    }

    options = { ...options };

    options.type = QueryTypes.UPSERT;
    options.updateOnDuplicate = Object.keys(updateValues);

    const model = options.model;
    const { query, bind } = this.queryGenerator.insertQuery(tableName, insertValues, model.rawAttributes, options);

    delete options.replacements;
    options.bind = combineBinds(options.bind, bind);

    return await this.sequelize.queryRaw(query, options);
  }

  /** @override */
  async removeConstraint(tableName, constraintName, options) {
    const sql = this.queryGenerator.showConstraintsQuery(
      tableName.tableName ? tableName : {
        tableName,
        schema: this.sequelize.config.database,
      }, constraintName,
    );

    const constraints = await this.sequelize.queryRaw(sql, {
      ...options,
      type: this.sequelize.QueryTypes.SHOWCONSTRAINTS,
    });

    const constraint = constraints[0];
    let query;
    if (!constraint || !constraint.constraintType) {
      throw new sequelizeErrors.UnknownConstraintError(
        {
          message: `Constraint ${constraintName} on table ${tableName} does not exist`,
          constraint: constraintName,
          table: tableName,
        },
      );
    }

    if (constraint.constraintType === 'FOREIGN KEY') {
      query = this.queryGenerator.dropForeignKeyQuery(tableName, constraintName);
    } else {
      query = this.queryGenerator.removeIndexQuery(constraint.tableName, constraint.constraintName);
    }

    return await this.sequelize.queryRaw(query, options);
  }
}
