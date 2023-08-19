import * as DataTypes from '../../data-types.js';
import type { ModelStatic, NormalizedAttributeOptions } from '../../model.js';
import { QueryTypes } from '../../query-types.js';
import type { QueryRawOptions } from '../../sequelize.js';
import { isModelStatic } from '../../utils/model-utils.js';
import { EMPTY_OBJECT } from '../../utils/object.js';
import type { DataTypeInstance } from '../abstract/data-types.js';
import type { TableNameOrModel } from '../abstract/query-generator-typescript.js';
import { AbstractQueryInterfaceInternal } from '../abstract/query-interface-internal.js';
import type { TableName } from '../abstract/query-interface.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { FetchDatabaseVersionOptions } from '../abstract/query-interface.types.js';
import type { ENUM } from './data-types.js';
import type {
  AddValueToEnumQueryOptions,
  CreateEnumQueryOptions,
  ListEnumQueryOptions,
} from './query-generator-typescript.js';
import type { PostgresQueryGenerator } from './query-generator.js';
import type { PostgresDialect } from './index.js';

interface QiListEnumsOptions extends ListEnumQueryOptions, Omit<QueryRawOptions, 'plain' | 'raw' | 'type'> {}

interface QiAddValueToEnumOptions extends AddValueToEnumQueryOptions, QueryRawOptions {}

interface QiCreateEnumOptions extends CreateEnumQueryOptions, QueryRawOptions {}

interface EnumDescription {
  name: string;
  values: string[];
}

export class PostgresQueryInterfaceTypescript extends AbstractQueryInterface {
  readonly #internalQueryInterface: AbstractQueryInterfaceInternal;
  readonly #queryGenerator: PostgresQueryGenerator;
  readonly #dialect: PostgresDialect;

  constructor(
    dialect: PostgresDialect,
    internalQueryInterface?: AbstractQueryInterfaceInternal,
  ) {
    internalQueryInterface ??= new AbstractQueryInterfaceInternal(dialect);

    super(dialect, internalQueryInterface);
    this.#dialect = dialect;
    this.#internalQueryInterface = internalQueryInterface;
    this.#queryGenerator = dialect.queryGenerator;
  }

  async createEnum(
    tableOrModel: TableNameOrModel,
    dataType: DataTypeInstance,
    options?: QiCreateEnumOptions,
  ): Promise<void> {
    await this.sequelize.queryRaw(
      this.#queryGenerator.createEnumQuery(tableOrModel, dataType, options),
      options,
    );
  }

  /**
   * Drop specified enum from database (Postgres only)
   *
   * @param schema
   * @param enumName
   * @param options
   */
  async dropEnum(schema: string, enumName: string, options: Omit<QueryRawOptions, 'raw'> = EMPTY_OBJECT): Promise<void> {
    await this.sequelize.queryRaw(
      this.#queryGenerator.dropEnumQuery(schema, enumName),
      { ...options, raw: true },
    );
  }

  /**
   * Drop all enums from database (Postgres only)
   *
   * @param options
   */
  async dropAllEnums(options: QiListEnumsOptions = EMPTY_OBJECT) {
    const schema = options?.schema || this.sequelize.options.schema || this.dialect.getDefaultSchema();

    const enums = await this.listEnums({
      ...options,
      schema,
    });

    return Promise.all(enums.map(async enumDescription => {
      return this.dropEnum(schema, enumDescription.name, options);
    }));
  }

  /**
   * List all enums (Postgres only)
   *
   * @param options
   */
  async listEnums(options: QiListEnumsOptions = EMPTY_OBJECT): Promise<EnumDescription[]> {
    const sql = this.#queryGenerator.listEnumsQuery(options);

    return this.sequelize.queryRaw<EnumDescription>(sql, { ...options, plain: false, raw: true, type: QueryTypes.SELECT });
  }

  async addValueToEnum(
    schema: string,
    dataTypeOrEnumName: DataTypeInstance | string,
    value: string,
    options?: QiAddValueToEnumOptions,
  ): Promise<void> {
    const sql = this.#queryGenerator.addValueToEnumQuery(schema, dataTypeOrEnumName, value, options);

    await this.sequelize.queryRaw(sql, options);
  }

  /**
   * Ensure enums and their values.
   *
   * @param model
   * @param options
   */
  // TODO: add variant for table + attributes
  async ensureEnums(model: ModelStatic, options?: QueryRawOptions): Promise<void>;
  async ensureEnums(table: TableName, columns: NormalizedAttributeOptions[], options?: QueryRawOptions): Promise<void>;
  async ensureEnums(
    ...params: [
        model: ModelStatic | TableName,
      columnsOrOptions?: NormalizedAttributeOptions[] | QueryRawOptions,
      options?: QueryRawOptions,
    ]
  ): Promise<void> {
    const connectionManager = this.#dialect.connectionManager;

    const isModelMode = isModelStatic(params[0]);
    const rawTable: TableName = isModelMode ? (params[0] as ModelStatic).table : params[0] as TableName;
    const attributes: NormalizedAttributeOptions[] = isModelMode
        ? [...(params[0] as ModelStatic).modelDefinition.attributes.values()]
        : params[1] as NormalizedAttributeOptions[];
    const options: QueryRawOptions | undefined = isModelMode
        ? params[1] as QueryRawOptions | undefined
        : params[2] as QueryRawOptions | undefined;

    const table = this.#queryGenerator.extractTableDetails(rawTable);
    const schema = table.schema;

    const listEnumsPromises: Array<Promise<EnumDescription[]>> = [];

    for (const attribute of attributes) {
      const type = attribute.type;

      if (
        type instanceof DataTypes.ENUM
        || type instanceof DataTypes.ARRAY && type.options.type instanceof DataTypes.ENUM
      ) {
        listEnumsPromises.push(this.listEnums({ schema: table.schema }));
      }
    }

    const results = await Promise.all(listEnumsPromises);
    const existingEnums = new Map<string, EnumDescription>();
    for (const result of results) {
      for (const enumDescription of result) {
        existingEnums.set(enumDescription.name, enumDescription);
      }
    }

    const modifyEnumPromises: Array<Promise<void>> = [];

    for (const attribute of attributes.values()) {
      const type = attribute.type;
      const enumType = type instanceof DataTypes.ARRAY ? type.options.type : type;

      if (!(enumType instanceof DataTypes.ENUM)) {
        continue;
      }

      const enumName = enumType.toSql();
      const existingEnum = existingEnums.get(enumName);

      if (!existingEnum) {
        modifyEnumPromises.push(this.createEnum(table, enumType, options));

        continue;
      }

      modifyEnumPromises.push(this.#syncExistingEnum(schema, enumName, existingEnum, enumType, options));
    }

    await Promise.all(modifyEnumPromises);

    // If ENUM processed, then refresh OIDs
    if (modifyEnumPromises.length > 0) {
      await connectionManager.refreshDynamicOids();
    }
  }

  async #syncExistingEnum(
    schema: string,
    enumName: string,
    existingEnum: EnumDescription,
    enumType: ENUM<string>,
    options?: QueryRawOptions,
  ): Promise<void> {
    const existingVals = existingEnum.values;
    const newVals = enumType.options.values;

    // Going through already existing values allows us to make queries that depend on those values
    // We will prepend all new values between the old ones, but keep in mind - we can't change order of already existing values
    // Then we append the rest of new values AFTER the latest already existing value
    // E.g.: [1,2] -> [0,2,1] ==> [1,0,2]
    // E.g.: [1,2,3] -> [2,1,3,4] ==> [1,2,3,4]
    // E.g.: [1] -> [0,2,3] ==> [1,0,2,3]
    let lastOldEnumValue;
    let rightestPosition = -1;
    for (let oldIndex = 0; oldIndex < existingVals.length; oldIndex++) {
      const enumVal = existingVals[oldIndex];
      const newIdx = newVals.indexOf(enumVal);
      lastOldEnumValue = enumVal;

      if (newIdx === -1) {
        continue;
      }

      const newValuesBefore = newVals.slice(0, newIdx);
      // we go in reverse order so we could stop when we meet old value
      for (let reverseIdx = newValuesBefore.length - 1; reverseIdx >= 0; reverseIdx--) {
        if (existingVals.includes(newValuesBefore[reverseIdx])) {
          break;
        }

        // eslint-disable-next-line no-await-in-loop -- these operations cannot run concurrently
        await this.addValueToEnum(schema, enumName, newValuesBefore[reverseIdx], {
          ...options,
          before: lastOldEnumValue,
        });
      }

      // we detect the most 'right' position of old value in new enum array so we can append new values to it
      if (newIdx > rightestPosition) {
        rightestPosition = newIdx;
      }
    }

    if (lastOldEnumValue && rightestPosition < newVals.length - 1) {
      const remainingEnumValues = newVals.slice(rightestPosition + 1);
      for (let reverseIdx = remainingEnumValues.length - 1; reverseIdx >= 0; reverseIdx--) {
        // eslint-disable-next-line no-await-in-loop -- these operations cannot run concurrently
        await this.addValueToEnum(schema, enumName, remainingEnumValues[reverseIdx], {
          ...options,
          after: lastOldEnumValue,
        });
      }
    }
  }

  async fetchDatabaseVersion(options?: FetchDatabaseVersionOptions): Promise<string> {
    const payload = await this.#internalQueryInterface.fetchDatabaseVersionRaw<{ server_version: string }>(options);

    return payload.server_version;
  }
}
