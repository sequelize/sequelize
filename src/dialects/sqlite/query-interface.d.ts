import type { Sequelize } from '../../sequelize.js';
import { QueryInterface } from '../abstract/query-interface.js';
import type { SqliteQueryGenerator } from './query-generator.js';

export class SqliteQueryInterface extends QueryInterface {
  queryGenerator: SqliteQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: SqliteQueryGenerator);
}
