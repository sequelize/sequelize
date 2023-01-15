'use strict';

import { getObjectFromMap } from '../../utils/object';
import { assertNoReservedBind, combineBinds } from '../../utils/sql';

const sequelizeErrors = require('../../errors');
const { AbstractQueryInterface } = require('../abstract/query-interface');
const { QueryTypes } = require('../../query-types');

/**
 * The interface that Sequelize uses to talk with MySQL/MariaDB database
 */
export class MySqlQueryInterface extends AbstractQueryInterface {
  /**
   * A wrapper that fixes MySQL's inability to cleanly remove columns from existing tables if they have a foreign key constraint.
   *
   * @override
   */
  async removeColumn(tableName, columnName, options) {
    options = options || {};

    const [results] = await this.sequelize.queryRaw(
      this.queryGenerator.getForeignKeyQuery(tableName.tableName ? tableName : {
        tableName,
        schema: this.sequelize.config.database,
      }, columnName),
      { raw: true, ...options },
    );

    // Exclude primary key constraint
    if (results.length > 0 && results[0].constraint_name !== 'PRIMARY') {
      await Promise.all(results.map(constraint => this.sequelize.queryRaw(
        this.queryGenerator.dropForeignKeyQuery(tableName, constraint.constraint_name),
        { raw: true, ...options },
      )));
    }

    return await this.sequelize.queryRaw(
      this.queryGenerator.removeColumnQuery(tableName, columnName),
      { raw: true, ...options },
    );
  }

  /**
   * @override
   */
  async upsert(tableName, insertValues, updateValues, where, options) {
    if (options.bind) {
      assertNoReservedBind(options.bind);
    }

    const modelDefinition = options.model.modelDefinition;

    options = { ...options };

    options.type = QueryTypes.UPSERT;
    options.updateOnDuplicate = Object.keys(updateValues);
    options.upsertKeys = Array.from(modelDefinition.primaryKeysAttributeNames, pkAttrName => modelDefinition.getColumnName(pkAttrName));

    const { query, bind } = this.queryGenerator.insertQuery(tableName, insertValues, getObjectFromMap(modelDefinition.attributes), options);

    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
    delete options.replacements;
    options.bind = combineBinds(options.bind, bind);

    return await this.sequelize.queryRaw(query, options);
  }

  /**
   * @override
   */
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
