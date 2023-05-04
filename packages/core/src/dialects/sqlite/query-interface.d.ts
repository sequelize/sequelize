import type { Sequelize } from '../../sequelize.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { SqliteQueryGenerator } from './query-generator.js';

export class SqliteQueryInterface extends AbstractQueryInterface {
  queryGenerator: SqliteQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: SqliteQueryGenerator);
}
