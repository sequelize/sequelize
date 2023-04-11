import type { SnowflakeQueryGenerator } from './query-generator.js';
import type { Sequelize } from '../../sequelize.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';

export class SnowflakeQueryInterface extends AbstractQueryInterface {
  queryGenerator: SnowflakeQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: SnowflakeQueryGenerator);
}
