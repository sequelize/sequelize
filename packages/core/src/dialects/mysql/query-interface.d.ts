import type { Sequelize } from '../../sequelize.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { MySqlQueryGenerator } from './query-generator.js';

export class MySqlQueryInterface extends AbstractQueryInterface {
  queryGenerator: MySqlQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: MySqlQueryGenerator);
}
