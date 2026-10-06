import assert from 'node:assert';
import { QueryTypes } from '../enums.js';
import type { NormalizedAttributeOptions } from '../model.js';
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

  /**
   * Runs the query used by {@link AbstractQueryInterface#describeTable}, and returns its unprocessed result.
   * Dialects can override this, e.g. to pass the table name as a bind parameter.
   *
   * @param table
   * @param options
   */
  async describeTableRaw(
    table: TableNameWithSchema,
    options?: QueryRawOptions,
  ): Promise<ColumnsDescription> {
    return this.#sequelize.queryRaw(this.#queryGenerator.describeTableQuery(table), {
      ...options,
      type: QueryTypes.DESCRIBE,
    });
  }

  /**
   * Runs the query used by {@link AbstractQueryInterface#showConstraints}, and returns its unprocessed rows.
   * Dialects can override this, e.g. to pass the table name as a bind parameter.
   *
   * @param tableName
   * @param options
   */
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
