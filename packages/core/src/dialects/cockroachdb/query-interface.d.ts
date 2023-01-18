import type { Sequelize } from '../../sequelize.js';
import { PostgresQueryInterface } from '../postgres/query-interface.js';
import type { CockroachDbQueryGenerator } from './query-generator';

export class CockroachDbQueryInterface extends PostgresQueryInterface {
  queryGenerator: CockroachDbQueryGenerator;

  constructor(sequilize: Sequelize, queryGenerator: CockroachDbQueryGenerator);
}
