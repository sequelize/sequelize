// Copyright (c) 2024, Oracle and/or its affiliates. All rights reserved

import type { Cast } from 'src/expression-builders/cast.js';
import { attributeTypeToSql } from '../abstract/data-types-utils.js';
import { AbstractQueryGeneratorInternal } from '../abstract/query-generator-internal.js';
import type { EscapeOptions } from '../abstract/query-generator-typescript.js';
import type { AddLimitOffsetOptions } from '../abstract/query-generator.types.js';
import { wrapAmbiguousWhere } from '../abstract/where-sql-builder.js';
import type { OracleDialect } from './index.js';

export class OracleQueryGeneratorInternal<Dialect extends OracleDialect = OracleDialect>
  extends AbstractQueryGeneratorInternal<Dialect> {

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

    let castSql = wrapAmbiguousWhere(cast.expression, this.queryGenerator.escape(cast.expression, { ...options, type }));
    const targetSql = attributeTypeToSql(type).toUpperCase();

    // TODO: if we're casting to the same SQL DataType, we could skip the SQL cast (but keep the JS cast)
    //  This is useful because sometimes you want to cast the Sequelize DataType to another Sequelize DataType,
    //  but they are both the same SQL type, so a SQL cast would be redundant.
    if (type === 'boolean') {
      castSql = `(CASE WHEN ${castSql}='true' THEN 1 ELSE 0 END)`;

      return `CAST(${castSql} AS NUMBER)`;
    } else if (type === 'TIMESTAMPTZ') {
      castSql = castSql.slice(0, -1);

      return `${castSql} RETURNING TIMESTAMP WITH TIME ZONE)`;
    }

    return `CAST(${castSql} AS ${targetSql})`;
  }
}
