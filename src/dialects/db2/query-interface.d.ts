import type { Sequelize } from '../../sequelize.js';
import { QueryInterface } from '../abstract/query-interface.js';
import type { Db2QueryGenerator } from './query-generator.js';

export class Db2QueryInterface extends QueryInterface {
  queryGenerator: Db2QueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: Db2QueryGenerator);
}
