import { Dialect, Sequelize } from './sequelize';
import { SequelizeMethod } from './utils';

/**
 * Interface that Sequelize uses to transform javascript queries into SQL text.
 *
 * Most of its usage is internal and is un-typed, but some helpful methods are exposed.
 */
export class QueryGenerator {

  /**
   * Returns the current sequelize instance.
   */
  public sequelize: Sequelize;
  public dialect: Dialect;

   public handleSequelizeMethod(smth: SequelizeMethod): string
}
