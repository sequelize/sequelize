import type { Sequelize } from '../../sequelize.js';
import type { OracleQueryGenerator } from './query-generator.js';
import { OracleQueryInterfaceTypescript } from './query-interface-typescript.js';

export class OracleQueryInterface extends OracleQueryInterfaceTypescript {
  queryGenerator: OracleQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: OracleQueryGenerator);
}