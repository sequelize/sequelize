import type { FetchDatabaseVersionOptions } from '@sequelize/core';
import { AbstractQueryInterface } from '@sequelize/core';
import { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface-internal.js';
import type { PostgresDialect } from './dialect.js';

export class PostgresQueryInterfaceTypescript<
  Dialect extends PostgresDialect = PostgresDialect,
> extends AbstractQueryInterface<Dialect> {
  readonly #internalQueryInterface: AbstractQueryInterfaceInternal;

  constructor(dialect: Dialect, internalQueryInterface?: AbstractQueryInterfaceInternal) {
    internalQueryInterface ??= new AbstractQueryInterfaceInternal(dialect);

    super(dialect, internalQueryInterface);
    this.#internalQueryInterface = internalQueryInterface;
  }

  async fetchDatabaseVersion(options?: FetchDatabaseVersionOptions): Promise<string> {
    const payload = await this.#internalQueryInterface.fetchDatabaseVersionRaw<{
      server_version: string;
    }>(options);

    return payload.server_version;
  }
}
