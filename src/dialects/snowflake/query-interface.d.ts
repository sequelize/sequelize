import type { Sequelize } from '../../sequelize.js';
import { QueryInterface } from '../abstract/query-interface.js';
import type { SnowflakeQueryGenerator } from './query-generator.js';

export class SnowflakeQueryInterface extends QueryInterface {
  queryGenerator: SnowflakeQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: SnowflakeQueryGenerator);
}
