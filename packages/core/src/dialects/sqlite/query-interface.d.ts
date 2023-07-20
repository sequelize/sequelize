import type { Sequelize } from '../../sequelize.js';
import type { SqliteQueryGenerator } from './query-generator.js';
import { SqliteQueryInterfaceTypeScript } from './query-interface-typescript.js';

export class SqliteQueryInterface extends SqliteQueryInterfaceTypeScript {
  queryGenerator: SqliteQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: SqliteQueryGenerator);
}
