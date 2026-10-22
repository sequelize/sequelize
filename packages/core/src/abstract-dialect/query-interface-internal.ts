import assert from 'node:assert';
import { QueryTypes } from '../enums.js';
import type { AttributeOptions, NormalizedAttributeOptions } from '../model.js';
import type { QueryRawOptions, Sequelize } from '../sequelize.js';
import type { AbstractDialect } from './dialect.js';
import type { AbstractQueryGenerator } from './query-generator.js';
import type { TableOrModel } from './query-generator.types.js';
import type { TableNameWithSchema } from './query-interface.js';
import type {
  ColumnsDescription,
  FetchDatabaseVersionOptions,
  RawConstraintDescription,
  ShowConstraintsOptions,
} from './query-interface.types.js';

/**
 * The methods in this class are not part of the public API.
 */
export class AbstractQueryInterfaceInternal {
  readonly #dialect: AbstractDialect;

  get #sequelize(): Sequelize {
    return this.#dialect.sequelize;
  }

  get #queryGenerator(): AbstractQueryGenerator {
    return this.#dialect.queryGenerator;
  }

  constructor(dialect: AbstractDialect) {
    this.#dialect = dialect;
  }

  async fetchDatabaseVersionRaw<T extends object>(
    options?: FetchDatabaseVersionOptions,
  ): Promise<T> {
    const out = await this.#sequelize.queryRaw<T>(this.#queryGenerator.versionQuery(), {
      ...options,
      type: QueryTypes.SELECT,
      plain: true,
    });

    assert(out != null);

    return out;
  }

  /**
   * Returns the attribute with its reference moved into `schema`, if that reference targets the
   * dialect's default schema. References that target any other schema are returned untouched.
   *
   * @param attribute
   * @param schema
   */
  withReferencesSchema(
    attribute: NormalizedAttributeOptions,
    schema: string,
  ): NormalizedAttributeOptions {
    if (!attribute.references) {
      return attribute;
    }

    const referencedTable = this.#queryGenerator.extractTableDetails(attribute.references.table);
    if (referencedTable.schema !== this.#dialect.getDefaultSchema()) {
      return attribute;
    }

    return {
      ...attribute,
      references: { ...attribute.references, table: { ...referencedTable, schema } },
    };
  }

  async showIndexRaw(tableName: TableOrModel, options?: QueryRawOptions): Promise<unknown> {
    return this.#sequelize.queryRaw(this.#queryGenerator.showIndexesQuery(tableName), {
      ...options,
      type: QueryTypes.SHOWINDEXES,
    });
  }

  async describeTableRaw(
    table: TableNameWithSchema,
    options?: QueryRawOptions,
  ): Promise<ColumnsDescription> {
    return this.#sequelize.queryRaw(this.#queryGenerator.describeTableQuery(table), {
      ...options,
      type: QueryTypes.DESCRIBE,
    });
  }

  async showConstraintsRaw(
    tableName: TableOrModel,
    options?: ShowConstraintsOptions,
  ): Promise<RawConstraintDescription[]> {
    return this.#sequelize.queryRaw(this.#queryGenerator.showConstraintsQuery(tableName, options), {
      ...options,
      raw: true,
      type: QueryTypes.SHOWCONSTRAINTS,
    });
  }

  /**
   * Returns whether {@link AbstractQueryInterface#changeColumn} needs to add a unique key to the column, as requested by its "unique" option.
   * This is only the case if the table does not have a unique key on exactly that column yet,
   * so calling changeColumn again does not add another one.
   *
   * @param tableName The table that contains the column
   * @param columnName The name of the column, as it is in the database
   * @param unique The value of the "unique" attribute option
   * @param options Query options
   */
  async needsUniqueKey(
    tableName: TableOrModel,
    columnName: string,
    unique: AttributeOptions['unique'],
    options?: QueryRawOptions,
  ): Promise<boolean> {
    if (!unique) {
      return false;
    }

    if (unique !== true) {
      throw new TypeError(
        `queryInterface.changeColumn only accepts "unique: true", which adds a unique key on the column if it does not have one yet. Use queryInterface.addConstraint to add a named or composite unique key. Received: ${JSON.stringify(unique)}`,
      );
    }

    return !(await this.hasUniqueKey(tableName, columnName, options));
  }

  /**
   * Returns whether the table has a unique key (a unique constraint, a unique index, or the primary key) on exactly the given column.
   *
   * Both the unique constraints and the indexes of the table are checked, because depending on the dialect,
   * a unique key can be a unique index without a unique constraint.
   * Snowflake does not report which columns its unique constraints are on, so they are never found there.
   *
   * @param tableName The table that contains the column
   * @param columnName The name of the column, as it is in the database
   * @param options Query options
   */
  async hasUniqueKey(
    tableName: TableOrModel,
    columnName: string,
    options?: QueryRawOptions,
  ): Promise<boolean> {
    const queryInterface = this.#sequelize.queryInterface;

    // unquoted identifiers are case-insensitive
    const normalize = this.#sequelize.options.quoteIdentifiers
      ? (name: string) => name
      : (name: string) => name.toLowerCase();
    const isOnColumn = (columnNames: readonly string[] | undefined) =>
      columnNames?.length === 1 && normalize(columnNames[0]) === normalize(columnName);

    const constraints = await queryInterface.showConstraints(tableName, {
      ...options,
      constraintType: 'UNIQUE',
    });

    if (constraints.some(constraint => isOnColumn(constraint.columnNames))) {
      return true;
    }

    const indexes = await queryInterface.showIndex(tableName, options);

    return indexes.some(
      index =>
        (index.unique || index.primary) && isOnColumn(index.fields.map(field => field.attribute)),
    );
  }

  /**
   * Adds a unique constraint on the column, or a unique index if the dialect cannot add constraints to existing tables.
   * {@link AbstractQueryInterface#changeColumn} uses this in dialects where the ALTER COLUMN query cannot add the unique key
   * (`dialect.supports.alterColumn.unique` is false).
   *
   * @param tableName The table that contains the column
   * @param columnName The name of the column, as it is in the database
   * @param options Query options
   */
  async addUniqueKey(
    tableName: TableOrModel,
    columnName: string,
    options?: QueryRawOptions,
  ): Promise<void> {
    if (!this.#dialect.supports.constraints.add) {
      await this.addUniqueIndex(tableName, columnName, options);

      return;
    }

    await this.#sequelize.queryInterface.addConstraint(tableName, {
      ...options,
      type: 'UNIQUE',
      fields: [columnName],
    });
  }

  /**
   * Adds a unique index on the column.
   *
   * @param tableName The table that contains the column
   * @param columnName The name of the column, as it is in the database
   * @param options Query options
   */
  async addUniqueIndex(
    tableName: TableOrModel,
    columnName: string,
    options?: QueryRawOptions,
  ): Promise<void> {
    await this.#sequelize.queryInterface.addIndex(tableName, {
      ...options,
      // in addIndex, "type" is the type of the index (e.g. FULLTEXT), not the type of the query
      type: undefined,
      fields: [columnName],
      unique: true,
    });
  }

  async executeQueriesSequentially(queries: string[], options?: QueryRawOptions): Promise<unknown> {
    const results = [];
    for (const query of queries) {
      // eslint-disable-next-line no-await-in-loop
      const result = await this.#sequelize.queryRaw(query, { ...options });
      results.push(result);
    }

    return results;
  }
}
