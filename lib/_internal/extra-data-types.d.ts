import type { AbstractDialect, BindParamOptions, DataTypeClassOrInstance, Rangable } from '@sequelize/core';
import { DataTypes } from '@sequelize/core';
import type { AcceptableTypeOf, BaseNumberDataType, DATE, DATEONLY, INTEGER } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/data-types.js';
import { AbstractRange, kDataTypeIdentifier } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/data-types.js';
import type { HstoreRecord } from './hstore.js';
/**
 * A key / value store column. Only available in Postgres.
 *
 * __Fallback policy:__
 * If the dialect does not support this type natively, an error will be raised.
 *
 * @example
 * ```ts
 * DataTypes.HSTORE
 * ```
 *
 * @category DataTypes
 */
export declare class HSTORE extends DataTypes.ABSTRACT<HstoreRecord> {
    /** @hidden */
    static readonly [kDataTypeIdentifier]: string;
    protected _checkOptionSupport(dialect: AbstractDialect): void;
    validate(value: any): void;
    toBindableValue(value: HstoreRecord): string;
    toSql(): string;
}
export interface RangeOptions {
    subtype?: DataTypeClassOrInstance;
}
/**
 * Range types are data types representing a range of values of some element type (called the range's subtype).
 * Only available in Postgres. See [the Postgres documentation](http://www.postgresql.org/docs/9.4/static/rangetypes.html) for more details
 *
 * __Fallback policy:__
 * If this type is not supported, an error will be raised.
 *
 * @example
 * ```ts
 * // A range of integers
 * DataTypes.RANGE(DataTypes.INTEGER)
 * // A range of bigints
 * DataTypes.RANGE(DataTypes.BIGINT)
 * // A range of decimals
 * DataTypes.RANGE(DataTypes.DECIMAL)
 * // A range of timestamps
 * DataTypes.RANGE(DataTypes.DATE)
 * // A range of dates
 * DataTypes.RANGE(DataTypes.DATEONLY)
 * ```
 *
 * @category DataTypes
 */
export declare class RANGE<T extends BaseNumberDataType | DATE | DATEONLY = INTEGER> extends AbstractRange<T> {
    #private;
    parseDatabaseValue(value: unknown): unknown;
    sanitize(value: unknown): unknown;
    validate(value: any): void;
    toBindableValue(values: Rangable<AcceptableTypeOf<T>>): string;
    escape(values: Rangable<AcceptableTypeOf<T>>): string;
    getBindParamSql(values: Rangable<AcceptableTypeOf<T>>, options: BindParamOptions): string;
    toSql(): string;
    static typeMap: Record<string, string>;
}
