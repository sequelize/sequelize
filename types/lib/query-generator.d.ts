import { WhereOptions } from './model';
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
   public readonly sequelize: Sequelize;
   public readonly dialect: Dialect;

   /**
    * @example
    * queryGenerator.handleSequelizeMethod(fn('FOO', col('abc.xyz')) // FOO("abc"."xyz")
    *
    * @param {object} smth - sequelize method
    * @returns {string} SQL
    */
   public handleSequelizeMethod(smth: SequelizeMethod): string;

   /**
    * @example
    * queryGenerator.handleSequelizeMethod({
    *   [Op.and]: [
    *       where(fn('FOO', { [Op.in]: [1, 2] })),
    *       where(col('abc.xyz', Op.eq, 123),
    *   ],
    * }) // (FOO() IN (1,2) AND "abc.xyz" = 123)
    *
    * @param {object} where - where object
    * @returns {string} SQL
    */
   public whereItemsQuery(where: WhereOptions): string;
}
