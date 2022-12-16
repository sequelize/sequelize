import type { Sequelize } from '../../sequelize.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { MsSqlQueryGenerator } from './query-generator.js';

export class MsSqlQueryInterface extends AbstractQueryInterface {
  queryGenerator: MsSqlQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: MsSqlQueryGenerator);
}
