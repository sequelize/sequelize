import DataTypes = require('./data-types');
import Deferrable = require('./deferrable');
import Op from './operators';
import QueryTypes = require('./query-types');
import TableHints = require('./table-hints');
import IndexHints = require('./index-hints');
import Utils = require('./utils');

export * from './associations/index';
export * from './data-types';
export * from './errors/index';
export { BaseError as Error } from './errors/index';
export * from './model';
export * from './dialects/abstract/query-interface';
export * from './sequelize';
export * from './transaction';
export { useInflection } from './utils';
export { Validator } from './utils/validator-extras';
export { Utils, QueryTypes, Op, TableHints, IndexHints, DataTypes, Deferrable };

/**
 * Type helper for making certain fields of an object optional. This is helpful
 * for creating the `CreationAttributes` from your `Attributes` for a Model.
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
