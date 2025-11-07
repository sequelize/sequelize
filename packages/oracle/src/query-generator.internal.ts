// Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

import { attributeTypeToSql } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types-utils.js';
import { AbstractQueryGeneratorInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-internal.js';
import type { EscapeOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import type { AddLimitOffsetOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.internal-types.js';
import { wrapAmbiguousWhere } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/where-sql-builder.js';
import type { Cast } from '@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/cast.js';
import type { OracleDialect } from './dialect.js';

export class OracleQueryGeneratorInternal<
  Dialect extends OracleDialect = OracleDialect,
> extends AbstractQueryGeneratorInternal<Dialect> {
  addLimitAndOffset(options: AddLimitOffsetOptions) {
    let fragment = '';
    const offset = options.offset || 0;

    if (options.offset || options.limit) {
      fragment += ` OFFSET ${this.queryGenerator.escape(offset, options)} ROWS`;
    }

    if (options.limit) {
      fragment += ` FETCH NEXT ${this.queryGenerator.escape(options.limit, options)} ROWS ONLY`;
    }

    return fragment;
  }

  formatCast(cast: Cast, options?: EscapeOptions | undefined): string {
    const type = this.sequelize.normalizeDataType(cast.type);

    let castSql = wrapAmbiguousWhere(
      cast.expression,
      this.queryGenerator.escape(cast.expression, { ...options, type }),
    );
    const targetSql = attributeTypeToSql(type).toUpperCase();

    if (type === 'boolean') {
      castSql = `(CASE WHEN ${castSql}='true' THEN 1 ELSE 0 END)`;

      return `CAST(${castSql} AS NUMBER)`;
    } else if (type === 'TIMESTAMPTZ') {
      castSql = castSql.slice(0, -1);

      return `${castSql} RETURNING TIMESTAMP WITH TIME ZONE)`;
    }

    return `CAST(${castSql} AS ${targetSql})`;
  }

  getAliasToken(): string {
    return '';
  }
}
