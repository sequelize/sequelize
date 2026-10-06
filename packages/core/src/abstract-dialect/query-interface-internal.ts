import assert from 'node:assert';
import { QueryTypes } from '../enums.js';
import type { AttributeOptions, NormalizedAttributeOptions } from '../model.js';
import type { QueryRawOptions, Sequelize } from '../sequelize.js';
import type { AbstractDialect } from './dialect.js';
import type { AbstractQueryGenerator } from './query-generator.js';
import type { TableOrModel } from './query-generator.types.js';
import type { FetchDatabaseVersionOptions } from './query-interface.types.js';

/**
 * Returns the name requested by the "unique" option of an attribute, if any.
 * If an array is provided, the name of the first unique key that specifies one is used.
 *
 * @param unique The "unique" option of an attribute.
 */
function getUniqueKeyName(unique: AttributeOptions['unique']): string | undefined {
  const uniqueKeys = Array.isArray(unique) ? unique : [unique];

  for (const uniqueKey of uniqueKeys) {
    if (typeof uniqueKey === 'string') {
      return uniqueKey;
    }

    if (uniqueKey && typeof uniqueKey === 'object' && uniqueKey.name) {
      return uniqueKey.name;
    }
  }

  return undefined;
}

function isSameColumnList(columnNames: readonly string[] | undefined, columnName: string): boolean {
  return columnNames?.length === 1 && columnNames[0] === columnName;
}

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

  /**
   * Makes sure that the column is unique, as requested by the "unique" option of {@link AbstractQueryInterface#changeColumn}.
   *
   * Nothing is added if the table already has a unique key (a unique constraint, a unique index, or the primary key)
   * on exactly that column, or a unique key with the requested name.
   * Otherwise, a unique constraint is added (see {@link addUniqueKey}).
   *
   * This makes changeColumn idempotent, instead of adding a duplicate unique key each time it is called.
   *
   * @param tableName The table that contains the column
   * @param columnName The name of the column, as it is in the database
   * @param unique The value of the "unique" attribute option.
   * Only single-column unique keys are supported: if a name is specified, it is used to name the unique key,
   * but it is not combined with other columns.
   * @param options Query options
   */
  async ensureUniqueKey(
    tableName: TableOrModel,
    columnName: string,
    unique: AttributeOptions['unique'],
    options?: QueryRawOptions,
  ): Promise<void> {
    if (!unique) {
      return;
    }

    const name = getUniqueKeyName(unique);
    if (await this.hasUniqueKey(tableName, columnName, name, options)) {
      return;
    }

    await this.addUniqueKey(tableName, columnName, name, options);
  }

  /**
   * Returns whether the table has a unique key on exactly the given column, or a unique key named `name`.
   *
   * Both the unique constraints and the indexes of the table are checked, because depending on the dialect,
   * a unique key can be a unique constraint without a unique index (snowflake), or a unique index without a unique constraint.
   *
   * @param tableName
   * @param columnName
   * @param name
   * @param options
   */
  async hasUniqueKey(
    tableName: TableOrModel,
    columnName: string,
    name: string | undefined,
    options?: QueryRawOptions,
  ): Promise<boolean> {
    const queryInterface = this.#sequelize.queryInterface;

    const constraints = await queryInterface.showConstraints(tableName, {
      ...options,
      constraintType: 'UNIQUE',
    });

    if (
      constraints.some(
        constraint =>
          (name != null && constraint.constraintName === name) ||
          isSameColumnList(constraint.columnNames, columnName),
      )
    ) {
      return true;
    }

    const indexes = await queryInterface.showIndex(tableName, options);

    return indexes.some(
      index =>
        (index.unique || index.primary) &&
        ((name != null && index.name === name) ||
          isSameColumnList(
            index.fields.map(field => field.attribute),
            columnName,
          )),
    );
  }

  /**
   * Adds a unique key on a single column.
   * This adds a unique constraint, or a unique index if the dialect cannot add constraints to existing tables.
   *
   * Dialects can override this method if they cannot add a unique constraint to some columns.
   *
   * @param tableName
   * @param columnName
   * @param name The name of the unique key. If not specified, the default name of {@link AbstractQueryInterface#addConstraint} or {@link AbstractQueryInterface#addIndex} is used.
   * @param options
   */
  async addUniqueKey(
    tableName: TableOrModel,
    columnName: string,
    name: string | undefined,
    options?: QueryRawOptions,
  ): Promise<void> {
    if (!this.#dialect.supports.constraints.add) {
      await this.addUniqueIndex(tableName, columnName, name, options);

      return;
    }

    await this.#sequelize.queryInterface.addConstraint(tableName, {
      ...options,
      type: 'UNIQUE',
      fields: [columnName],
      ...(name != null && { name }),
    });
  }

  /**
   * Adds a unique index on a single column.
   *
   * @param tableName
   * @param columnName
   * @param name The name of the index. If not specified, the default name of {@link AbstractQueryInterface#addIndex} is used.
   * @param options
   */
  async addUniqueIndex(
    tableName: TableOrModel,
    columnName: string,
    name: string | undefined,
    options?: QueryRawOptions,
  ): Promise<void> {
    await this.#sequelize.queryInterface.addIndex(tableName, {
      ...options,
      // in addIndex, "type" is the type of the index (e.g. FULLTEXT), not the type of the query
      type: undefined,
      fields: [columnName],
      unique: true,
      ...(name != null && { name }),
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
