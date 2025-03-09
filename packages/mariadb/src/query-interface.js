'use strict';

import { AbstractQueryInterface, QueryTypes } from '@sequelize/core';
import { getObjectFromMap } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import {
  assertNoReservedBind,
  combineBinds,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';

/**
 * The interface that Sequelize uses to talk with MariaDB database
 */
export class MariaDbQueryInterface extends AbstractQueryInterface {
  /**
   * A wrapper that fixes MariaDb's inability to cleanly remove columns from existing tables if they have a foreign key constraint.
   *
   * @override
   */
  async removeColumn(tableName, columnName, options) {
    const foreignKeys = await this.showConstraints(tableName, {
      ...options,
      columnName,
      constraintType: 'FOREIGN KEY',
    });
    await Promise.all(
      foreignKeys.map(constraint =>
        this.removeConstraint(tableName, constraint.constraintName, options),
      ),
    );

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
    options.upsertKeys = Array.from(modelDefinition.primaryKeysAttributeNames, pkAttrName =>
      modelDefinition.getColumnName(pkAttrName),
    );

    const { bind, query } = this.queryGenerator.insertQuery(
      tableName,
      insertValues,
      getObjectFromMap(modelDefinition.attributes),
      options,
    );

    // unlike bind, replacements are handled by QueryGenerator, not QueryRaw
    delete options.replacements;
    options.bind = combineBinds(options.bind, bind);

    return this.sequelize.queryRaw(query, options);
  }
}
