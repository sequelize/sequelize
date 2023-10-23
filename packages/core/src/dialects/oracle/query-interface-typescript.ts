import type { Sequelize } from '../../sequelize.js';
import { AbstractQueryInterfaceInternal } from '../abstract/query-interface-internal.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { FetchDatabaseVersionOptions } from '../abstract/query-interface.types.js';
import type { OracleQueryGenerator } from './query-generator.js';

export class OracleQueryInterfaceTypescript extends AbstractQueryInterface {
  #internalQueryInterface: AbstractQueryInterfaceInternal;

  constructor(
    sequelize: Sequelize,
    queryGenerator: OracleQueryGenerator,
    internalQueryInterface?: AbstractQueryInterfaceInternal,
  ) {
    internalQueryInterface ??= new AbstractQueryInterfaceInternal(sequelize, queryGenerator);

    super(sequelize, queryGenerator, internalQueryInterface);
    this.#internalQueryInterface = internalQueryInterface;
  }

  async fetchDatabaseVersion(options?: FetchDatabaseVersionOptions): Promise<string> {
    const payload = await this.#internalQueryInterface.fetchDatabaseVersionRaw<{ VERSION_FULL: string }>(options);

    return payload.VERSION_FULL;
  }
}
