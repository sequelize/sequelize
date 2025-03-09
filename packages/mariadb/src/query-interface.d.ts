import { AbstractQueryInterface } from '@sequelize/core';
import type { MariaDbDialect } from './dialect.js';

export class MariaDbQueryInterface<
  Dialect extends MariaDbDialect = MariaDbDialect,
> extends AbstractQueryInterface<Dialect> {}
