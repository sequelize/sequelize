import type { Sequelize } from '../../sequelize.js';
import { QueryInterface } from '../abstract/query-interface.js';
import type { MsSqlQueryGenerator } from './query-generator.js';

export class MsSqlQueryInterface extends QueryInterface {
  queryGenerator: MsSqlQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: MsSqlQueryGenerator);
}
