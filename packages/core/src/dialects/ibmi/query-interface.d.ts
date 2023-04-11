import type { IBMiQueryGenerator } from './query-generator.js';
import type { Sequelize } from '../../sequelize.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';

export class IBMiQueryInterface extends AbstractQueryInterface {
  queryGenerator: IBMiQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: IBMiQueryGenerator);
}
