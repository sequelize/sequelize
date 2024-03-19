import type { Sequelize } from '../../sequelize.js';
import type { AbstractDialect } from './index.js';

/**
 * This class is used to configure the dialect before it is attached to a Sequelize instance.
 */
export abstract class AbstractAdapter {
  abstract getDialect(sequelize: Sequelize): AbstractDialect;
}
