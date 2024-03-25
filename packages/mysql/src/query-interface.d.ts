import { AbstractQueryInterface } from '@sequelize/core';
import type { MySqlDialect } from './dialect.js';

export class MySqlQueryInterface<
  Dialect extends MySqlDialect = MySqlDialect,
> extends AbstractQueryInterface<Dialect> {}
