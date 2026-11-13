import type {
  ColumnsDescription,
  QueryRawOptions,
  RawConstraintDescription,
  ShowConstraintsOptions,
  TableOrModel,
} from '@sequelize/core';
import { ParameterStyle, QueryTypes } from '@sequelize/core';
import { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface-internal.js';
import type { OracleDialect } from './dialect.js';

// Oracle hard parses every distinct SQL text, which is slow on the dictionary views.
// Binding the names lets it reuse the parsed statements across tables.
export class OracleQueryInterfaceInternal extends AbstractQueryInterfaceInternal {
  constructor(readonly dialect: OracleDialect) {
    super(dialect);
  }

  async showIndexRaw(tableName: TableOrModel, options?: QueryRawOptions): Promise<unknown> {
    const { query, bind } = this.dialect.queryGenerator.showIndexesQuery(tableName, {
      parameterStyle: ParameterStyle.BIND,
    });

    return this.dialect.sequelize.queryRaw(query, {
      logQueryParameters: true,
      ...options,
      bind,
      type: QueryTypes.SHOWINDEXES,
    });
  }

  async describeTableRaw(
    tableName: TableOrModel,
    options?: QueryRawOptions,
  ): Promise<ColumnsDescription> {
    const databaseVersion = this.dialect.sequelize.getDatabaseVersionIfExist();
    const { query, bind } = this.dialect.queryGenerator.describeTableQuery(tableName, {
      parameterStyle: ParameterStyle.BIND,
    });

    const description = await this.dialect.sequelize.queryRaw(query, {
      logQueryParameters: true,
      ...options,
      bind,
      type: QueryTypes.DESCRIBE,
    });

    // The first connection discovers the version after the catalog SQL was generated.
    // Regenerate it once so version-gated VECTOR metadata is included when supported.
    if (!databaseVersion && this.dialect.sequelize.getDatabaseVersionIfExist()) {
      return this.describeTableRaw(tableName, options);
    }

    return description;
  }

  async showConstraintsRaw(
    tableName: TableOrModel,
    options?: ShowConstraintsOptions,
  ): Promise<RawConstraintDescription[]> {
    const { query, bind } = this.dialect.queryGenerator.showConstraintsQuery(tableName, {
      ...options,
      parameterStyle: ParameterStyle.BIND,
    });

    return this.dialect.sequelize.queryRaw(query, {
      logQueryParameters: true,
      ...options,
      bind,
      raw: true,
      type: QueryTypes.SHOWCONSTRAINTS,
    });
  }
}
