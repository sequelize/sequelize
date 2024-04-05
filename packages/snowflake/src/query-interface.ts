import { AbstractQueryInterface } from '@sequelize/core';
import type { SnowflakeDialect } from './dialect.js';

export class SnowflakeQueryInterface<
  Dialect extends SnowflakeDialect = SnowflakeDialect,
> extends AbstractQueryInterface<Dialect> {}
