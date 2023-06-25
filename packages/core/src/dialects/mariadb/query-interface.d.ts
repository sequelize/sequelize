import type { Sequelize } from '../../sequelize.js';
import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { MariaDbQueryGenerator } from './query-generator.js';

export class MariaDbQueryInterface extends AbstractQueryInterface {
  queryGenerator: MariaDbQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: MariaDbQueryGenerator);
}
