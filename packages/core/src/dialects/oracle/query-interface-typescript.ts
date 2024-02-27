// Copyright (c) 2024, Oracle and/or its affiliates. All rights reserved
import { AbstractQueryInterfaceInternal } from '../abstract/query-interface-internal.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { FetchDatabaseVersionOptions, QiDropAllTablesOptions } from '../abstract/query-interface.types.js';
import type { OracleDialect } from './index.js';

export class OracleQueryInterfaceTypescript<Dialect extends OracleDialect = OracleDialect> extends AbstractQueryInterface {

  #internalQueryInterface: AbstractQueryInterfaceInternal;

  constructor(
    dialect: Dialect,
    internalQueryInterface?: AbstractQueryInterfaceInternal,
  ) {
    internalQueryInterface ??= new AbstractQueryInterfaceInternal(dialect);

    super(dialect, internalQueryInterface);
    this.#internalQueryInterface = internalQueryInterface;
  }

  async fetchDatabaseVersion(options?: FetchDatabaseVersionOptions): Promise<string> {
    const payload = await this.#internalQueryInterface.fetchDatabaseVersionRaw<{ VERSION_FULL: string }>(options);

    return payload.VERSION_FULL;
  }

  async dropAllTables(options?: QiDropAllTablesOptions | undefined): Promise<void> {
    const skip = options?.skip || [];
    const allTables = await this.listTables(options);
    const tableNames = allTables.filter(tableName => !skip.includes(tableName.tableName));

    const dropOptions = { ...options };
    // enable "cascade" by default if supported by this dialect
    if (this.sequelize.dialect.supports.dropTable.cascade && dropOptions.cascade === undefined) {
      dropOptions.cascade = true;
    }

    // Drop all the tables loop to avoid deadlocks and timeouts
    for (const tableName of tableNames) {
      // eslint-disable-next-line no-await-in-loop
      await this.dropTable(tableName, dropOptions);
    }
  }
}
