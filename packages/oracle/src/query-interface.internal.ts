// Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

import type {
  ColumnsDescription,
  QueryRawOptions,
  RawConstraintDescription,
  ShowConstraintsOptions,
  TableNameWithSchema,
  TableOrModel,
} from '@sequelize/core';
import { QueryTypes } from '@sequelize/core';
import { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface-internal.js';
import type { OracleDialect } from './dialect.js';

/**
 * Runs the dictionary queries with bind parameters instead of literals,
 * so Oracle does not hard parse them again for every table.
 */
export class OracleQueryInterfaceInternal extends AbstractQueryInterfaceInternal {
  constructor(readonly dialect: OracleDialect) {
    super(dialect);
  }

  async describeTableRaw(
    table: TableNameWithSchema,
    options?: QueryRawOptions,
  ): Promise<ColumnsDescription> {
    const { bind, query } = this.dialect.queryGenerator.describeTableQueryWithBind(table);

    return this.dialect.sequelize.queryRaw(query, {
      ...options,
      bind,
      type: QueryTypes.DESCRIBE,
    });
  }

  async showConstraintsRaw(
    tableName: TableOrModel,
    options?: ShowConstraintsOptions,
  ): Promise<RawConstraintDescription[]> {
    const { bind, query } = this.dialect.queryGenerator.showConstraintsQueryWithBind(
      tableName,
      options,
    );

    return this.dialect.sequelize.queryRaw(query, {
      ...options,
      bind,
      raw: true,
      type: QueryTypes.SHOWCONSTRAINTS,
    });
  }
}
