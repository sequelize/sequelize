'use strict';

import { EMPTY_OBJECT, getObjectFromMap } from '../../utils/object';
import { assertNoReservedBind, combineBinds } from '../../utils/sql';

const { AbstractQueryInterface } = require('../abstract/query-interface');
const { QueryTypes } = require('../../query-types');

/**
 * The interface that Sequelize uses to talk with MariaDB database
 */
export class MariaDbQueryInterface extends AbstractQueryInterface {
  /**
   * A wrapper that fixes MariaDb's inability to cleanly remove columns from existing tables if they have a foreign key constraint.
   *
   * @override
   */
  async removeColumn(tableName, columnName, options = EMPTY_OBJECT) {
    const [results] = await this.sequelize.queryRaw(
      this.queryGenerator.getForeignKeyQuery(tableName, columnName),
      { raw: true, ...options },
    );

    // Exclude primary key constraint
    if (results.length > 0 && results[0].constraintName !== 'PRIMARY') {
      await Promise.all(results.map(constraint => this.sequelize.queryRaw(
        this.queryGenerator.dropForeignKeyQuery(tableName, constraint.constraintName),
        { raw: true, ...options },
      )));
    }

    return this.sequelize.queryRaw(
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

    return this.sequelize.queryRaw(query, options);
  }
}
