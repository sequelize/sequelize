import type { Sequelize } from '../../sequelize.js';
import { QueryInterface } from '../abstract/query-interface.js';
import type { PostgresQueryGenerator } from './query-generator.js';

export class PostgresQueryInterface extends QueryInterface {
  queryGenerator: PostgresQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: PostgresQueryGenerator);
}
