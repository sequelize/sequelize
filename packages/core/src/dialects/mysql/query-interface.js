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
    const foreignKeys = await this.showConstraints(tableName, { ...options, columnName, constraintType: 'FOREIGN KEY' });
    await Promise.all(foreignKeys.map(constraint => this.removeConstraint(tableName, constraint.constraintName, options)));

    await super.removeColumn(tableName, columnName, options);
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
   * A wrapper that fixes MySQL's lack of support for DROP CONSTRAINT in MySQL < 8.0.
   *
   * @override
   */
  // TODO [>=2023-11-01]: remove this override when MySQL 8.0 is the minimum supported version
  async removeConstraint(tableName, constraintName, options) {
    const queryOptions = { ...options, raw: true, constraintName };
    const constraints = await this.showConstraints(tableName, queryOptions);

    const constraint = constraints[0];
    if (!constraint || !constraint.constraintType) {
      throw new sequelizeErrors.UnknownConstraintError(
        {
          message: `Constraint ${constraintName} on table ${tableName} does not exist`,
          constraint: constraintName,
          table: tableName,
        },
      );
    }

    let query;
    if (constraint.constraintType === 'FOREIGN KEY') {
      query = `ALTER TABLE ${this.queryGenerator.quoteTable(tableName)} DROP FOREIGN KEY ${this.quoteIdentifier(constraint.constraintName)}`;
    } else {
      query = this.queryGenerator.removeIndexQuery(tableName, constraint.constraintName);
    }

    return this.sequelize.queryRaw(query, queryOptions);
  }
}
