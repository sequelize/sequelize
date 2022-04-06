import DataTypes = require('./data-types');
export { DataTypes };

export * as Utils from './utils';
export { QueryTypes } from './query-types';
export { IndexHints } from './index-hints';
export { TableHints } from './table-hints';
export { Op } from './operators';
export * from './transaction';

export type { Connection } from './dialects/abstract/connection-manager';
export * from './associations/index';
export * from './data-types';
export * from './errors';
export { BaseError as Error } from './errors';
export * from './model';
export * from './dialects/abstract/query-interface';
export * from './sequelize';
export { Sequelize as default } from './sequelize';
export { useInflection } from './utils';
export { Validator } from './utils/validator-extras';
export { Deferrable } from './deferrable';

/**
 * Type helper for making certain fields of an object optional. This is helpful
 * for creating the `CreationAttributes` from your `Attributes` for a Model.
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type PartlyRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
export { AllowReadonlyArray } from './utils/index.js';
export { AllowArray } from './utils/index.js';
