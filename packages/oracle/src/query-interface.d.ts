// Copyright (c) 2024, Oracle and/or its affiliates. All rights reserved

import type { OracleDialect } from './dialect.js';
import { OracleQueryInterfaceTypescript } from './query-interface-typescript.internal.ts';

export class OracleQueryInterface<
  Dialect extends OracleDialect = OracleDialect,
> extends OracleQueryInterfaceTypescript<Dialect> {}
