import { AbstractQueryInterfaceInternal } from '../abstract/query-interface-internal.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { FetchDatabaseVersionOptions } from '../abstract/query-interface.types.js';
import type { PostgresDialect } from './index.js';

export class PostgresQueryInterfaceTypescript<
  Dialect extends PostgresDialect = PostgresDialect,
> extends AbstractQueryInterface<Dialect> {
  #internalQueryInterface: AbstractQueryInterfaceInternal;

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
