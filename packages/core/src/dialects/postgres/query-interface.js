'use strict';

import { Deferrable } from '../../deferrable';
import { camelizeObjectKeys } from '../../utils/object';
import { PostgresQueryInterfaceTypescript } from './query-interface-typescript.js';

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
    await super.dropTable(tableName, options);
    const promises = [];
    // TODO: we support receiving the model class instead of getting it from modelManager. More than one model can use the same table.
    const model = this.sequelize.modelManager.findModel(model => this.queryGenerator.isSameTable(model.table, tableName));

    if (!model) {
      // Do nothing when model is not available
      return;
    }

    const getTableName = (!options || !options.schema || options.schema === 'public' ? '' : `${options.schema}_`) + tableName;

    const attributes = model.modelDefinition.attributes;

    for (const attribute of attributes.values()) {
      if (!(attribute.type instanceof DataTypes.ENUM)) {
        continue;
      }

      const sql = this.queryGenerator.pgEnumDrop(getTableName, attribute.attributeName);
      promises.push(this.sequelize.queryRaw(sql, {
        ...options,
        raw: true,
        supportsSearchPath: false,
      }));
    }

    await Promise.all(promises);
  }
}
