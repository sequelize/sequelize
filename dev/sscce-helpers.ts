import type { Options, Sequelize } from '../packages/core';
import * as Support from '../packages/core/test/support';

export function createSequelizeInstance(options: Options = {}): Sequelize {
  return Support.createSequelizeInstance({
    logging: console.debug,
    logQueryParameters: true,
    ...options,
  });
}
