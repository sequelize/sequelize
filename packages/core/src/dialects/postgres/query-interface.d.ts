import type { PostgresQueryGenerator } from './query-generator.js';
import type { Sequelize } from '../../sequelize.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';

export class PostgresQueryInterface extends AbstractQueryInterface {
  queryGenerator: PostgresQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: PostgresQueryGenerator);
}
