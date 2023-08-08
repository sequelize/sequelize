import type { Sequelize } from '../../sequelize.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { OracleQueryGenerator } from './query-generator.js';

export class OracleQueryInterface extends AbstractQueryInterface {
  queryGenerator: OracleQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: OracleQueryGenerator);
}