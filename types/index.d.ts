import DataTypes = require('./lib/data-types');
import Deferrable = require('./lib/deferrable');
import Op = require('./lib/operators');
import QueryTypes = require('./lib/query-types');
import TableHints = require('./lib/table-hints');
import IndexHints = require('./lib/index-hints');
import Utils = require('./lib/utils');

export * from './lib/sequelize';
export * from './lib/query-interface';
export * from './lib/data-types';
export * from './lib/model';
export * from './lib/transaction';
export * from './lib/associations/index';
export * from './lib/errors';
export { BaseError as Error } from './lib/errors';
export { useInflection } from './lib/utils';
export { Utils, QueryTypes, Op, TableHints, IndexHints, DataTypes, Deferrable };
export { Validator } from './lib/utils/validator-extras';

/**
 * Type helper for making certain fields of an object optional. This is helpful
 * for creating the `CreationAttributes` from your `Attributes` for a Model.
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
