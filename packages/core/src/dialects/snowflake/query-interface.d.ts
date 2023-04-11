import type { Sequelize } from '../../sequelize.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { SnowflakeQueryGenerator } from './query-generator.js';

export class SnowflakeQueryInterface extends AbstractQueryInterface {
  queryGenerator: SnowflakeQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: SnowflakeQueryGenerator);
}
