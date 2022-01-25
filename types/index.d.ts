import DataTypes = require("./lib/data-types");
import Deferrable = require("./lib/deferrable");
import * as Utils from "../lib/utils";

export { QueryTypes } from "../lib/query-types";
export { IndexHints } from "../lib/index-hints";
export { TableHints } from "../lib/table-hints";
export { Op } from "../lib/operators";
export * from "../lib/transaction";

export type { Connection } from "./lib/connection-manager";
export * from "./lib/associations/index";
export * from "./lib/data-types";
export * from "./lib/errors";
export { BaseError as Error } from "./lib/errors";
export * from "./lib/model";
export * from "./lib/query-interface";
export * from "./lib/sequelize";
export { Validator } from "./lib/utils/validator-extras";
export { Utils, DataTypes, Deferrable };

/**
 * Type helper for making certain fields of an object optional. This is helpful
 * for creating the `CreationAttributes` from your `Attributes` for a Model.
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type PartlyRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };

export type AnyFunction = (...args: any[]) => any;

/**
 * Returns all shallow properties that accept `undefined`.
 * Does not include Optional properties, only `undefined`.
 *
 * @example
 * type UndefinedProps = UndefinedPropertiesOf<{
 *   id: number | undefined,
 *   createdAt: string | undefined,
 *   firstName: string,
 *   lastName?: string, // optional properties are not included.
 * }>;
 *
 * // is equal to
 *
 * type UndefinedProps = 'id' | 'createdAt';
 */
export type UndefinedPropertiesOf<T> = {
  [P in keyof T]-?: undefined extends T[P] ? P : never
}[keyof T];

/**
 * Makes all shallow properties of an object `optional` if they accept `undefined` as a value.
 *
 * @example
 * type MyOptionalType = MakeUndefinedOptional<{
 *   id: number | undefined,
 *   name: string,
 * }>;
 *
 * // is equal to
 *
 * type MyOptionalType = {
 *   // this property is optional.
 *   id?: number | undefined,
 *   name: string,
 * };
 */
export type MakeUndefinedOptional<T extends object> = Optional<T, UndefinedPropertiesOf<T>>;
