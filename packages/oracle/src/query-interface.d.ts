// Copyright (c) 2024, Oracle and/or its affiliates. All rights reserved

import { OracleQueryInterfaceTypescript } from './query-interface-typescript.internal.ts';
import type { OracleDialect } from './dialect.js';

export class OracleQueryInterface<
  Dialect extends OracleDialect = OracleDialect,
> extends OracleQueryInterfaceTypescript<Dialect> {}
