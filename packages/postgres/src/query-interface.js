'use strict';

import { DataTypes, QueryTypes } from '@sequelize/core';
import { PostgresQueryInterfaceTypescript } from './query-interface-typescript.internal.js';

/**
 * The interface that Sequelize uses to talk with Postgres database
 */
export class PostgresQueryInterface extends PostgresQueryInterfaceTypescript {
  /**
   * Ensure enum and their values.
   *
   * @param {string} tableName  Name of table to create
   * @param {object} attributes Object representing a list of normalized table attributes
   * @param {object} [options]
   * @param {Model}  [model]
   *
   * @protected
   */
  async ensureEnums(tableName, attributes, options, model) {
    const keys = Object.keys(attributes);
    const keyLen = keys.length;

    let sql = '';
    let promises = [];
    let i = 0;

    for (i = 0; i < keyLen; i++) {
      const attribute = attributes[keys[i]];
      const type = attribute.type;

      if (
        type instanceof DataTypes.ENUM ||
        (type instanceof DataTypes.ARRAY && type.options.type instanceof DataTypes.ENUM) // ARRAY sub type is ENUM
      ) {
        const enumType = type instanceof DataTypes.ARRAY ? type.options.type : type;
        const enumOptions =
          enumType.options.name || enumType.options.schema !== undefined
            ? {
                ...options,
                ...(enumType.options.name && { enumName: enumType.options.name }),
                ...(enumType.options.schema !== undefined && {
                  enumSchema: enumType.options.schema,
                }),
              }
            : options;
        sql = this.queryGenerator.pgListEnums(tableName, attribute.field || keys[i], enumOptions);
        promises.push(
          this.sequelize.queryRaw(sql, {
            ...options,
            plain: true,
            raw: true,
            type: QueryTypes.SELECT,
          }),
        );
      }
    }

    const results = await Promise.all(promises);
    promises = [];
    let enumIdx = 0;

    // This little function allows us to re-use the same code that prepends or appends new value to enum array
    const addEnumValue = (
      field,
      value,
      relativeValue,
      position = 'before',
      spliceStart = promises.length,
      enumName = undefined,
      enumSchema = undefined,
    ) => {
      const valueOptions = { ...options };
      if (enumName !== undefined) {
        valueOptions.enumName = enumName;
      }

      if (enumSchema !== undefined) {
        valueOptions.enumSchema = enumSchema;
      }

      valueOptions.before = null;
      valueOptions.after = null;

      switch (position) {
        case 'after':
          valueOptions.after = relativeValue;
          break;
        case 'before':
        default:
          valueOptions.before = relativeValue;
          break;
      }

      promises.splice(spliceStart, 0, () => {
        return this.sequelize.queryRaw(
          this.queryGenerator.pgEnumAdd(tableName, field, value, valueOptions),
          valueOptions,
        );
      });
    };

    for (i = 0; i < keyLen; i++) {
      const attribute = attributes[keys[i]];
      const type = attribute.type;
      const enumType = type instanceof DataTypes.ARRAY ? type.options.type : type;
      const field = attribute.field || keys[i];

      if (
        type instanceof DataTypes.ENUM ||
        (type instanceof DataTypes.ARRAY && enumType instanceof DataTypes.ENUM) // ARRAY sub type is ENUM
      ) {
        const customEnumName = enumType.options.name;
        const customEnumSchema = enumType.options.schema;
        const enumOptions =
          customEnumName || customEnumSchema !== undefined
            ? {
                ...options,
                ...(customEnumName && { enumName: customEnumName }),
                ...(customEnumSchema !== undefined && { enumSchema: customEnumSchema }),
              }
            : options;

        // If the enum type doesn't exist then create it
        if (!results[enumIdx]) {
          promises.push(() => {
            return this.sequelize.queryRaw(
              this.queryGenerator.pgEnum(tableName, field, enumType, enumOptions),
              { ...enumOptions, raw: true },
            );
          });
        } else if (Boolean(results[enumIdx]) && Boolean(model)) {
          const enumVals = this.queryGenerator.fromArray(results[enumIdx].enum_value);
          const vals = enumType.options.values;

          // Going through already existing values allows us to make queries that depend on those values
          // We will prepend all new values between the old ones, but keep in mind - we can't change order of already existing values
          // Then we append the rest of new values AFTER the latest already existing value
          // E.g.: [1,2] -> [0,2,1] ==> [1,0,2]
          // E.g.: [1,2,3] -> [2,1,3,4] ==> [1,2,3,4]
          // E.g.: [1] -> [0,2,3] ==> [1,0,2,3]
          let lastOldEnumValue;
          let rightestPosition = -1;
          for (let oldIndex = 0; oldIndex < enumVals.length; oldIndex++) {
            const enumVal = enumVals[oldIndex];
            const newIdx = vals.indexOf(enumVal);
            lastOldEnumValue = enumVal;

            if (newIdx === -1) {
              continue;
            }

            const newValuesBefore = vals.slice(0, newIdx);
            const promisesLength = promises.length;
            // we go in reverse order so we could stop when we meet old value
            for (let reverseIdx = newValuesBefore.length - 1; reverseIdx >= 0; reverseIdx--) {
              if (enumVals.includes(newValuesBefore[reverseIdx])) {
                break;
              }

              addEnumValue(
                field,
                newValuesBefore[reverseIdx],
                lastOldEnumValue,
                'before',
                promisesLength,
                customEnumName,
                customEnumSchema,
              );
            }

            // we detect the most 'right' position of old value in new enum array so we can append new values to it
            if (newIdx > rightestPosition) {
              rightestPosition = newIdx;
            }
          }

          if (lastOldEnumValue && rightestPosition < vals.length - 1) {
            const remainingEnumValues = vals.slice(rightestPosition + 1);
            for (let reverseIdx = remainingEnumValues.length - 1; reverseIdx >= 0; reverseIdx--) {
              addEnumValue(
                field,
                remainingEnumValues[reverseIdx],
                lastOldEnumValue,
                'after',
                promises.length,
                customEnumName,
                customEnumSchema,
              );
            }
          }
        }

        // Continue to the next enum
        enumIdx++;
      }
    }

    const result = await promises.reduce(
      async (promise, asyncFunction) => await asyncFunction(await promise),
      Promise.resolve(),
    );

    // If ENUM processed, then refresh OIDs
    if (promises.length > 0) {
      await this.sequelize.dialect.connectionManager.refreshDynamicOids();
    }

    return result;
  }

  /**
   * Drop specified enum from database (Postgres only)
   *
   * @param {string} [enumName]  Enum name to drop
   * @param {object} options Query options
   *
   * @returns {Promise}
   */
  async dropEnum(enumName, options) {
    options ||= {};

    return this.sequelize.queryRaw(
      this.queryGenerator.pgEnumDrop(null, null, this.queryGenerator.quoteIdentifier(enumName)),
      { ...options, raw: true },
    );
  }

  /**
   * Drop all enums from database (Postgres only)
   *
   * @param {object} options Query options
   *
   * @returns {Promise}
   */
  async dropAllEnums(options) {
    options ||= {};

    const enums = await this.pgListEnums(null, options);

    return await Promise.all(
      enums.map(result =>
        this.sequelize.queryRaw(
          this.queryGenerator.pgEnumDrop(
            null,
            null,
            this.queryGenerator.quoteIdentifier(result.enum_name),
          ),
          { ...options, raw: true },
        ),
      ),
    );
  }

  /**
   * List all enums (Postgres only)
   *
   * @param {string} [tableName]  Table whose enum to list
   * @param {object} [options]    Query options
   *
   * @returns {Promise}
   */
  async pgListEnums(tableName, options) {
    options ||= {};
    const sql = this.queryGenerator.pgListEnums(tableName);

    return this.sequelize.queryRaw(sql, {
      ...options,
      plain: false,
      raw: true,
      type: QueryTypes.SELECT,
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
    const model = this.sequelize.models.find(model =>
      this.queryGenerator.isSameTable(model.table, tableName),
    );

    if (!model) {
      // Do nothing when model is not available
      return;
    }

    const getTableName =
      (!options || !options.schema || options.schema === 'public' ? '' : `${options.schema}_`) +
      tableName;

    const attributes = model.modelDefinition.attributes;

    for (const attribute of attributes.values()) {
      if (!(attribute.type instanceof DataTypes.ENUM)) {
        continue;
      }

      const enumType = attribute.type;
      let sql;
      if (enumType.options.name) {
        // Custom enum name: compute the fully-qualified type name with optional schema override
        const fullEnumName = this.queryGenerator.pgEnumName(
          { tableName, schema: options?.schema },
          attribute.attributeName,
          {
            enumName: enumType.options.name,
            ...(enumType.options.schema !== undefined && {
              enumSchema: enumType.options.schema,
            }),
          },
        );
        sql = this.queryGenerator.pgEnumDrop(null, null, fullEnumName);
      } else {
        sql = this.queryGenerator.pgEnumDrop(getTableName, attribute.attributeName);
      }

      promises.push(
        this.sequelize.queryRaw(sql, {
          ...options,
          raw: true,
          supportsSearchPath: false,
        }),
      );
    }

    await Promise.all(promises);
  }
}
