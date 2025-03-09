import type { AbstractDialect } from '@sequelize/core';
import type { Options, Sequelize } from '../packages/core';
import * as Support from '../packages/core/test/support';

export function createSequelizeInstance<Dialect extends AbstractDialect>(
  options: Options<Dialect>,
): Sequelize<Dialect> {
  return Support.createSequelizeInstance({
    logging: console.debug,
    logQueryParameters: true,
    ...options,
  });
}
