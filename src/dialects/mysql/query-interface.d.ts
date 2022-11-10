import type { Sequelize } from '../../sequelize.js';
import { QueryInterface } from '../abstract/query-interface.js';
import type { MySqlQueryGenerator } from './query-generator.js';

export class MySqlQueryInterface extends QueryInterface {
  queryGenerator: MySqlQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: MySqlQueryGenerator);
}
