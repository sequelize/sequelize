// Copyright (c) 2024, Oracle and/or its affiliates. All rights reserved

import { AbstractQueryGeneratorInternal } from '../abstract/query-generator-internal.js';
import type { AddLimitOffsetOptions } from '../abstract/query-generator.types.js';
import type { OracleDialect } from './index.js';

export class OracleQueryGeneratorInternal<Dialect extends OracleDialect = OracleDialect>
  extends AbstractQueryGeneratorInternal<Dialect> {

  addLimitAndOffset(options : AddLimitOffsetOptions) {
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
}