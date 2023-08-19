import mapValues from 'lodash/mapValues.js';
import omit from 'lodash/omit';
import type { ModelStatic } from '../../model.js';
import type { QueryRawOptions } from '../../sequelize.js';
import { removeUndefined } from '../../utils/object.js';
import { normalizeChangeColumnAttribute } from '../abstract/query-generator-internal.js';
import type { TableNameOrModel } from '../abstract/query-generator-typescript.js';
import type { ChangeColumnDefinitions } from '../abstract/query-generator.types.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';
import { PROPERTIES_NEEDING_CHANGE_COLUMN } from './query-generator-typescript.js';

/**
 * The interface that Sequelize uses to talk with MySQL/MariaDB database
 */
export class MySqlQueryInterfaceTypeScript extends AbstractQueryInterface {

  async changeColumns(
    tableOrModel: TableNameOrModel | ModelStatic,
    columnDefinitions: ChangeColumnDefinitions,
    options?: QueryRawOptions,
  ) {
    let normalizedColumnDefinitions = mapValues(columnDefinitions, definition => {
      return normalizeChangeColumnAttribute(this.sequelize, definition);
    });

    // MySQL uses 'ALTER TABLE x CHANGE COLUMN' to alter columns, which require providing the complete definition,
    // but we want to be able to only change one property of the column, so we need to get the current definition,
    // and merge it with the new one.
    const needsPropertyMerge = Object.keys(normalizedColumnDefinitions).some(columnName => {
      const newDefinition = normalizedColumnDefinitions[columnName];

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

      normalizedColumnDefinitions = mapValues(normalizedColumnDefinitions, (newDefinition, columnName) => {
        const oldDefinition = tableDescription[columnName];

        if (oldDefinition == null) {
          return newDefinition;
        }

        return {
          ...omit(oldDefinition, ['primaryKey', 'defaultValue']),
          defaultValue: oldDefinition.defaultValue == null ? undefined : oldDefinition.defaultValue,
          dropDefaultValue: oldDefinition.defaultValue == null && newDefinition.defaultValue === undefined,
          comment: oldDefinition.comment ? oldDefinition.comment : undefined,
          ...removeUndefined(newDefinition),
        };
      });
    }

    return super.changeColumns(tableOrModel, normalizedColumnDefinitions, options);
  }
}
