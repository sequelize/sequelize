import { AbstractQueryInterface } from '@sequelize/core';
import type { HanaDialect } from './dialect.js';

export class HanaQueryInterface<
  Dialect extends HanaDialect = HanaDialect,
> extends AbstractQueryInterface<Dialect> {}
