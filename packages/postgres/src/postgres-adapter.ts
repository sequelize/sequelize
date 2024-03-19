import type { Sequelize } from '@sequelize/core';
import type { PostgresDialectOptions } from './dialect.js';
import { PostgresDialect } from './dialect.js';

export class PostgresAdapter {
  readonly #options: PostgresDialectOptions | undefined;

  constructor(options?: PostgresDialectOptions | undefined) {
    this.#options = options;
  }

  getDialect(sequelize: Sequelize): PostgresDialect {
    return new PostgresDialect(sequelize, this.#options);
  }
}
