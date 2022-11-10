import type { Sequelize } from '../../sequelize.js';
import { QueryInterface } from '../abstract/query-interface.js';
import type { IBMiQueryGenerator } from './query-generator.js';

export class IBMiQueryInterface extends QueryInterface {
  queryGenerator: IBMiQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: IBMiQueryGenerator);
}
