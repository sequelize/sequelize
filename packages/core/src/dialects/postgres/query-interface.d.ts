import type { Sequelize } from '../../sequelize.js';
import type { PostgresQueryGenerator } from './query-generator.js';
import { PostgresQueryInterfaceTypescript } from './query-interface-typescript.js';

export class PostgresQueryInterface extends PostgresQueryInterfaceTypescript {
  queryGenerator: PostgresQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: PostgresQueryGenerator);
}
