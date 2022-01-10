import DataTypes = require("./lib/data-types");
import Deferrable = require("./lib/deferrable");
import Op from "../lib/operators";
import QueryTypes = require("./lib/query-types");
import TableHints = require("./lib/table-hints");
import IndexHints = require("./lib/index-hints");
import Utils = require("./lib/utils");

export * from "./lib/associations/index";
export * from "./lib/data-types";
export * from "./lib/errors";
export { BaseError as Error } from "./lib/errors";
export * from "./lib/model";
export * from "./lib/query-interface";
export * from "./lib/sequelize";
export * from "./lib/transaction";
export { useInflection } from "./lib/utils";
export { Validator } from "./lib/utils/validator-extras";
export { Utils, QueryTypes, Op, TableHints, IndexHints, DataTypes, Deferrable };

/**
 * Type helper for making certain fields of an object optional. This is helpful
 * for creating the `CreationAttributes` from your `Attributes` for a Model.
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
