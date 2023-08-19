'use strict';

import { Deferrable } from '../../deferrable';
import { camelizeObjectKeys } from '../../utils/object';
import { PostgresQueryInterfaceTypescript } from './query-interface-typescript.js';
import { AbstractQueryInterfaceInternal } from '../abstract/query-interface-internal';
import { PostgresQueryGenerator } from './query-generator';
import { PostgresDialect } from './index';

const DataTypes = require('../../data-types');
const { QueryTypes } = require('../../query-types');

/**
 * The interface that Sequelize uses to talk with Postgres database
 */
export class PostgresQueryInterface extends PostgresQueryInterfaceTypescript {
  /**
   * @override
   */
  async getForeignKeyReferencesForTable(table, options) {
    const queryOptions = {
      ...options,
      type: QueryTypes.FOREIGNKEYS,
    };

    // postgres needs some special treatment as those field names returned are all lowercase
    // in order to keep same result with other dialects.
    const query = this.queryGenerator.getForeignKeyReferencesQuery(table.tableName || table, this.sequelize.config.database);
    const result = await this.sequelize.queryRaw(query, queryOptions);

    return result.map(fkMeta => {
      const { initiallyDeferred, isDeferrable, ...remaining } = camelizeObjectKeys(fkMeta);

      return {
        ...remaining,
        deferrable: isDeferrable === 'NO' ? Deferrable.NOT
          : initiallyDeferred === 'NO' ? Deferrable.INITIALLY_IMMEDIATE
          : Deferrable.INITIALLY_DEFERRED,
      };
    });
  }

  /**
   * Since postgres has a special case for enums, we should drop the related
   * enum type within the table and attribute
   *
   * @override
   */
  async dropTable(tableName, options) {
    const table = this.queryGenerator.extractTableDetails(tableName);

    await super.dropTable(tableName, options);
    const promises = [];
    // TODO: we support receiving the model class instead of getting it from modelManager. More than one model can use the same table.
    const model = this.sequelize.modelManager.findModel(model => this.queryGenerator.isSameTable(model.table, tableName));

    if (!model) {
      // Do nothing when model is not available
      return;
    }

    const attributes = model.modelDefinition.attributes;

    for (const attribute of attributes.values()) {
      if (!(attribute.type instanceof DataTypes.ENUM)) {
        continue;
      }

      await this.dropEnum(table.schema, attribute.type, options);
    }

    await Promise.all(promises);
  }
}
