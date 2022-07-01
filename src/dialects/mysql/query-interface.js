'use strict';

import mapValues from 'lodash/mapValues';
import omit from 'lodash/omit';
import { removeUndefined } from '../../utils';
import { assertNoReservedBind, combineBinds } from '../../utils/sql';
import { PROPERTIES_NEEDING_CHANGE_COLUMN } from './query-generator';

const sequelizeErrors = require('../../errors');
const { QueryInterface } = require('../abstract/query-interface');
const { QueryTypes } = require('../../query-types');

/**
 * The interface that Sequelize uses to talk with MySQL/MariaDB database
 */
export class MySqlQueryInterface extends QueryInterface {

  async changeColumns(tableOrModel, columnDefinitions, options) {
    // MySQL uses 'ALTER TABLE x CHANGE COLUMN' to alter columns, which require providing the complete definition,
    // but we want to be able to only change one property of the column, so we need to get the current definition,
    // and merge it with the new one.
    const needsPropertyMerge = Object.keys(columnDefinitions).some(columnName => {
      const newDefinition = columnDefinitions[columnName];

      let allAreUndefined = true;
      let allAreSet = true;

      for (const propertyUsingChangeColumn of PROPERTIES_NEEDING_CHANGE_COLUMN) {
        if (newDefinition[propertyUsingChangeColumn] !== undefined) {
          allAreUndefined = false;
        } else {
          allAreSet = false;
        }
      }

      return !(allAreUndefined || allAreSet);
    });

    if (needsPropertyMerge) {
      const tableDescription = await this.describeTable(tableOrModel);

      columnDefinitions = mapValues(columnDefinitions, (newDefinition, columnName) => {
        const oldDefinition = tableDescription[columnName];

        if (oldDefinition == null) {
          return newDefinition;
        }

        return {
          ...omit(oldDefinition, ['primaryKey', 'defaultValue']),
          defaultValue: oldDefinition.defaultValue == null ? undefined : oldDefinition.defaultValue,
          dropDefaultValue: oldDefinition.defaultValue == null && newDefinition.defaultValue === undefined,
          ...removeUndefined(newDefinition),
        };
      });
    }

    return super.changeColumns(tableOrModel, columnDefinitions, options);
  }

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

    options = { ...options };

    options.type = QueryTypes.UPSERT;
    options.updateOnDuplicate = Object.keys(updateValues);
    options.upsertKeys = Object.values(options.model.primaryKeys).map(item => item.field);

    const model = options.model;
    const { query, bind } = this.queryGenerator.insertQuery(tableName, insertValues, model.rawAttributes, options);

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
