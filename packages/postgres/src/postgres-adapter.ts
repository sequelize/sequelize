import type { Sequelize } from '@sequelize/core';
import { AbstractAdapter } from '@sequelize/core';
import type { PostgresDialectOptions } from './dialect.js';
import { PostgresDialect } from './dialect.js';

export class PostgresAdapter extends AbstractAdapter {
  readonly #options: PostgresDialectOptions | undefined;

  constructor(options?: PostgresDialectOptions | undefined) {
    super();

    this.#options = options;
  }

  getDialect(sequelize: Sequelize): PostgresDialect {
    return new PostgresDialect(sequelize, this.#options);
  }
}
