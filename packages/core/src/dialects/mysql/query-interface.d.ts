import type { MySqlQueryGenerator } from './query-generator.js';
import type { Sequelize } from '../../sequelize.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';

export class MySqlQueryInterface extends AbstractQueryInterface {
  queryGenerator: MySqlQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: MySqlQueryGenerator);
}
