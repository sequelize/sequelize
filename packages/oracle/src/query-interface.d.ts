// Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

import { AbstractQueryInterface } from '@sequelize/core';
import type { OracleDialect } from './dialect.js';

export class OracleQueryInterface<
  Dialect extends OracleDialect = OracleDialect,
> extends AbstractQueryInterface<Dialect> {}
