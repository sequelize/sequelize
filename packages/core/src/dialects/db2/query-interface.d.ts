import type { Sequelize } from '../../sequelize.js';
import type { Db2QueryGenerator } from './query-generator.js';
import { Db2QueryInterfaceTypeScript } from './query-interface-typescript.js';

export class Db2QueryInterface extends Db2QueryInterfaceTypeScript {
  queryGenerator: Db2QueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: Db2QueryGenerator);
}
