// Copyright (c) 2024, Oracle and/or its affiliates. All rights reserved

import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { OracleDialect } from './index.js';

export class OracleQueryInterface<Dialect extends OracleDialect = OracleDialect> extends AbstractQueryInterface<Dialect> {}
