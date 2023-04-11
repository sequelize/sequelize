import type { SqliteQueryGenerator } from './query-generator.js';
import type { Sequelize } from '../../sequelize.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';

export class SqliteQueryInterface extends AbstractQueryInterface {
  queryGenerator: SqliteQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: SqliteQueryGenerator);
}
