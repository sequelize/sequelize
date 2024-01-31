'use strict';

import { getObjectFromMap } from '../../utils/object';
import { assertNoReservedBind, combineBinds } from '../../utils/sql';

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
    const modelDefinition = model.modelDefinition;
    const { query, bind } = this.queryGenerator.insertQuery(tableName, insertValues, getObjectFromMap(modelDefinition.attributes), options);

    delete options.replacements;
    options.bind = combineBinds(options.bind, bind);

    return await this.sequelize.queryRaw(query, options);
  }
}
