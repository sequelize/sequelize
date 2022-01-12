import DataTypes = require("./lib/data-types");
import Deferrable = require("./lib/deferrable");
import Utils = require("./lib/utils");

export { QueryTypes } from "../lib/query-types";
export { IndexHints } from "../lib/index-hints";
export { TableHints } from "../lib/table-hints";
export { Op } from "../lib/operators";
export * from "../lib/transaction";
export { Literal, Col, Json, Fn, Cast, SequelizeMethod } from '../lib/utils';

export type { Connection } from "./lib/connection-manager";
export * from "./lib/associations/index";
export * from "./lib/data-types";
export * from "./lib/errors";
export { BaseError as Error } from "./lib/errors";
export * from "./lib/model";
export * from "./lib/query-interface";
export * from "./lib/sequelize";
export { useInflection } from "./lib/utils";
export { Validator } from "./lib/utils/validator-extras";
export { Utils, DataTypes, Deferrable };

/**
 * Type helper for making certain fields of an object optional. This is helpful
 * for creating the `CreationAttributes` from your `Attributes` for a Model.
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type PartlyRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
