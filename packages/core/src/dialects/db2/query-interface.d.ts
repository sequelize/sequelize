import type { Sequelize } from '../../sequelize.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { Db2QueryGenerator } from './query-generator.js';

export class Db2QueryInterface extends AbstractQueryInterface {
  queryGenerator: Db2QueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: Db2QueryGenerator);
}
