/**
 * The datatypes are used when defining a new model using `Model.init`, like this:
 * ```js
 * class MyModel extends MyModel {}
 * MyModel.init({ column: DataTypes.INTEGER }, { sequelize });
 * ```
 * When defining a model you can just as easily pass a string as type, but often using the types defined here is beneficial. For example, using `DataTypes.BLOB`, mean
 * that that column will be returned as an instance of `Buffer` when being fetched by sequelize.
 *
 * Some data types have special properties that can be accessed in order to change the data type.
 * For example, to get an unsigned integer with zerofill you can do `DataTypes.INTEGER.UNSIGNED.ZEROFILL`.
 * The order you access the properties in do not matter, so `DataTypes.INTEGER.ZEROFILL.UNSIGNED` is fine as well. The available properties are listed under each data type.
 *
 * To provide a length for the data type, you can invoke it like a function: `INTEGER(2)`
 *
 * Three of the values provided here (`NOW`, `UUIDV1` and `UUIDV4`) are special default values, that should not be used to define types. Instead they are used as shorthands for
 * defining default values. For example, to get a uuid field with a default value generated following v1 of the UUID standard:
 * ```js
 * class MyModel extends Model {}
 * MyModel.init({
 *   uuid: {
 *     type: DataTypes.UUID,
 *     defaultValue: DataTypes.UUIDV1,
 *     primaryKey: true
 *   }
 * }, { sequelize })
 * ```
 * There may be times when you want to generate your own UUID conforming to some other algorithm. This is accomplised
 * using the defaultValue property as well, but instead of specifying one of the supplied UUID types, you return a value
 * from a function.
 * ```js
 * class MyModel extends Model {}
 * MyModel.init({
 *   uuid: {
 *     type: DataTypes.UUID,
 *     defaultValue() {
 *       return generateMyId()
 *     },
 *     primaryKey: true
 *    }
 * }, { sequelize })
 * ```
 */

/**
 *
 */
export type DataType = string | AbstractDataTypeConstructor | AbstractDataType;

export const ABSTRACT: AbstractDataTypeConstructor;

interface AbstractDataTypeConstructor {
  key: string;
  warn(link: string, text: string): void;
}

export interface AbstractDataType {
  key: string;
  dialectTypes: string;
  toSql(): string;
  stringify(value: unknown, options?: object): string;
  toString(options: object): string;
}

/**
 * A variable length string. Default length 255
 */
export const STRING: StringDataTypeConstructor;

interface StringDataTypeConstructor extends AbstractDataTypeConstructor {
  new (length?: number, binary?: boolean): StringDataType;
  new (options?: StringDataTypeOptions): StringDataType;
  (length?: number, binary?: boolean): StringDataType;
  (options?: StringDataTypeOptions): StringDataType;
}

export interface StringDataType extends AbstractDataType {
  options?: StringDataTypeOptions;
  BINARY: this;
  validate(value: unknown): boolean;
}

export interface StringDataTypeOptions {
  length?: number;
  binary?: boolean;
}

/**
 * A fixed length string. Default length 255
 */
export const CHAR: CharDataTypeConstructor;

interface CharDataTypeConstructor extends StringDataTypeConstructor {
  new (length?: number, binary?: boolean): CharDataType;
  new (options?: CharDataTypeOptions): CharDataType;
  (length?: number, binary?: boolean): CharDataType;
  (options?: CharDataTypeOptions): CharDataType;
}

export interface CharDataType extends StringDataType {
  options: CharDataTypeOptions;
}

export interface CharDataTypeOptions extends StringDataTypeOptions {}
   
export type TextLength = 'tiny' | 'medium' | 'long';

/**
 * An (un)limited length text column. Available lengths: `tiny`, `medium`, `long`
 */
export const TEXT: TextDataTypeConstructor;

interface TextDataTypeConstructor extends AbstractDataTypeConstructor {
  new (length?: TextLength): TextDataType;
  new (options?: TextDataTypeOptions): TextDataType;
  (length?: TextLength): TextDataType;
  (options?: TextDataTypeOptions): TextDataType;
}

export interface TextDataType extends AbstractDataType {
  options: TextDataTypeOptions;
  validate(value: unknown): boolean;
}

export interface TextDataTypeOptions {
  length?: TextLength;
}

export const NUMBER: NumberDataTypeConstructor;

interface NumberDataTypeConstructor extends AbstractDataTypeConstructor {
  options: NumberDataTypeOptions;
  UNSIGNED: this;
  ZEROFILL: this;
  new (options?: NumberDataTypeOptions): NumberDataType;
  (options?: NumberDataTypeOptions): NumberDataType;
  validate(value: unknown): boolean;
}

export interface NumberDataType extends AbstractDataType {
  options: NumberDataTypeOptions;
  UNSIGNED: this;
  ZEROFILL: this;
  validate(value: unknown): boolean;
}

export interface IntegerDataTypeOptions {
  length?: number;
  zerofill?: boolean;
  unsigned?: boolean;
}
export interface NumberDataTypeOptions extends IntegerDataTypeOptions {
  decimals?: number;
  precision?: number;
  scale?: number;
}

/**
 * A 8 bit integer.
 */
export const TINYINT: TinyIntegerDataTypeConstructor;

interface TinyIntegerDataTypeConstructor extends NumberDataTypeConstructor {
  new (options?: IntegerDataTypeOptions): TinyIntegerDataType;
  (options?: IntegerDataTypeOptions): TinyIntegerDataType;
}

export interface TinyIntegerDataType extends NumberDataType {
  options: IntegerDataTypeOptions;
}

/**
 * A 16 bit integer.
 */
export const SMALLINT: SmallIntegerDataTypeConstructor;

interface SmallIntegerDataTypeConstructor extends NumberDataTypeConstructor {
  new (options?: IntegerDataTypeOptions): SmallIntegerDataType;
  (options?: IntegerDataTypeOptions): SmallIntegerDataType;
}

export interface SmallIntegerDataType extends NumberDataType {
  options: IntegerDataTypeOptions;
}

/**
 * A 24 bit integer.
 */
export const MEDIUMINT: MediumIntegerDataTypeConstructor;

interface MediumIntegerDataTypeConstructor extends NumberDataTypeConstructor {
  new (options?: IntegerDataTypeOptions): MediumIntegerDataType;
  (options?: IntegerDataTypeOptions): MediumIntegerDataType;
}

export interface MediumIntegerDataType extends NumberDataType {
  options: IntegerDataTypeOptions;
}

/**
 * A 32 bit integer.
 */
export const INTEGER: IntegerDataTypeConstructor;

interface IntegerDataTypeConstructor extends NumberDataTypeConstructor {
  new (options?: NumberDataTypeOptions): IntegerDataType;
  (options?: NumberDataTypeOptions): IntegerDataType;
}

export interface IntegerDataType extends NumberDataType {
  options: NumberDataTypeOptions;
}

/**
 * A 64 bit integer.
 *
 * Available properties: `UNSIGNED`, `ZEROFILL`
 *
 */
export const BIGINT: BigIntDataTypeConstructor;

interface BigIntDataTypeConstructor extends NumberDataTypeConstructor {
  new (options?: IntegerDataTypeOptions): BigIntDataType;
  (options?: IntegerDataTypeOptions): BigIntDataType;
}

export interface BigIntDataType extends NumberDataType {
  options: IntegerDataTypeOptions;
}

/**
 * Floating point number (4-byte precision). Accepts one or two arguments for precision
 */
export const FLOAT: FloatDataTypeConstructor;

interface FloatDataTypeConstructor extends NumberDataTypeConstructor {
  new (length?: number, decimals?: number): FloatDataType;
  new (options?: FloatDataTypeOptions): FloatDataType;
  (length?: number, decimals?: number): FloatDataType;
  (options?: FloatDataTypeOptions): FloatDataType;
}

export interface FloatDataType extends NumberDataType {
  options: FloatDataTypeOptions;
}

export interface FloatDataTypeOptions {
  length?: number;
  decimals?: number;
}

/**
 * Floating point number (4-byte precision). Accepts one or two arguments for precision
 */
export const REAL: RealDataTypeConstructor;

interface RealDataTypeConstructor extends NumberDataTypeConstructor {
  new (length?: number, decimals?: number): RealDataType;
  new (options?: RealDataTypeOptions): RealDataType;
  (length?: number, decimals?: number): RealDataType;
  (options?: RealDataTypeOptions): RealDataType;
}

export interface RealDataType extends NumberDataType {
  options: RealDataTypeOptions;
}

export interface RealDataTypeOptions {
  length?: number;
  decimals?: number;
}

/**
 * Floating point number (8-byte precision). Accepts one or two arguments for precision
 */
export const DOUBLE: DoubleDataTypeConstructor;

interface DoubleDataTypeConstructor extends NumberDataTypeConstructor {
  new (length?: number, decimals?: number): DoubleDataType;
  new (options?: DoubleDataTypeOptions): DoubleDataType;
  (length?: number, decimals?: number): DoubleDataType;
  (options?: DoubleDataTypeOptions): DoubleDataType;
}

export interface DoubleDataType extends NumberDataType {
  options: DoubleDataTypeOptions;
}

export interface DoubleDataTypeOptions {
  length?: number;
  decimals?: number;
}

/**
 * Decimal number. Accepts one or two arguments for precision
 */
export const DECIMAL: DecimalDataTypeConstructor;

interface DecimalDataTypeConstructor extends NumberDataTypeConstructor {
  PRECISION: this;
  SCALE: this;
  new (precision?: number, scale?: number): DecimalDataType;
  new (options?: DecimalDataTypeOptions): DecimalDataType;
  (precision?: number, scale?: number): DecimalDataType;
  (options?: DecimalDataTypeOptions): DecimalDataType;
}

export interface DecimalDataType extends NumberDataType {
  options: DecimalDataTypeOptions;
}

export interface DecimalDataTypeOptions {
  precision?: number;
  scale?: number;
}

/**
 * A boolean / tinyint column, depending on dialect
 */
export const BOOLEAN: AbstractDataTypeConstructor;

/**
 * A time column
 */
export const TIME: AbstractDataTypeConstructor;

/**
 * A datetime column
 */
export const DATE: DateDataTypeConstructor;

interface DateDataTypeConstructor extends AbstractDataTypeConstructor {
  new (length?: string | number): DateDataType;
  new (options?: DateDataTypeOptions): DateDataType;
  (length?: string | number): DateDataType;
  (options?: DateDataTypeOptions): DateDataType;
}

export interface DateDataType extends AbstractDataTypeConstructor {
  options: DateDataTypeOptions;
}

export interface DateDataTypeOptions {
  length?: string | number;
}

/**
 * A date only column
 */
export const DATEONLY: DateOnlyDataTypeConstructor;

interface DateOnlyDataTypeConstructor extends AbstractDataTypeConstructor {
  new (): DateOnlyDataType;
  (): DateOnlyDataType;
}

export interface DateOnlyDataType extends AbstractDataType {
}


/**
 * A key / value column. Only available in postgres.
 */
export const HSTORE: AbstractDataTypeConstructor;

/**
 * A JSON string column. Only available in postgres.
 */
export const JSON: AbstractDataTypeConstructor;

/**
 * A pre-processed JSON data column. Only available in postgres.
 */
export const JSONB: AbstractDataTypeConstructor;

/**
 * A default value of the current timestamp
 */
export const NOW: AbstractDataTypeConstructor;

/**
 * Binary storage. Available lengths: `tiny`, `medium`, `long`
 */
export const BLOB: BlobDataTypeConstructor;

export type BlobSize = 'tiny' | 'medium' | 'long';

interface BlobDataTypeConstructor extends AbstractDataTypeConstructor {
  new (length?: BlobSize): BlobDataType;
  new (options?: BlobDataTypeOptions): BlobDataType;
  (length?: BlobSize): BlobDataType;
  (options?: BlobDataTypeOptions): BlobDataType;
}

export interface BlobDataType extends AbstractDataType {
  options: BlobDataTypeOptions;
  escape: boolean;
}

export interface BlobDataTypeOptions {
  length?: BlobSize;
  escape?: boolean;
}

/**
 * Range types are data types representing a range of values of some element type (called the range's subtype).
 * Only available in postgres.
 *
 * See [Postgres documentation](http://www.postgresql.org/docs/9.4/static/rangetypes.html) for more details
 */
export const RANGE: RangeDataTypeConstructor;

export type RangeableDataType =
  | IntegerDataTypeConstructor
  | IntegerDataType
  | BigIntDataTypeConstructor
  | BigIntDataType
  | DecimalDataTypeConstructor
  | DecimalDataType
  | DateOnlyDataTypeConstructor
  | DateOnlyDataType
  | DateDataTypeConstructor
  | DateDataType;

interface RangeDataTypeConstructor extends AbstractDataTypeConstructor {
  new <T extends RangeableDataType>(subtype?: T): RangeDataType<T>;
  new <T extends RangeableDataType>(options: RangeDataTypeOptions<T>): RangeDataType<T>;
  <T extends RangeableDataType>(subtype?: T): RangeDataType<T>;
  <T extends RangeableDataType>(options: RangeDataTypeOptions<T>): RangeDataType<T>;
}

export interface RangeDataType<T extends RangeableDataType> extends AbstractDataType {
  options: RangeDataTypeOptions<T>;
}

export interface RangeDataTypeOptions<T extends RangeableDataType> {
  subtype?: T;
}

/**
 * A column storing a unique universal identifier. Use with `UUIDV1` or `UUIDV4` for default values.
 */
export const UUID: AbstractDataTypeConstructor;

/**
 * A default unique universal identifier generated following the UUID v1 standard
 */
export const UUIDV1: AbstractDataTypeConstructor;

/**
 * A default unique universal identifier generated following the UUID v4 standard
 */
export const UUIDV4: AbstractDataTypeConstructor;

/**
 * A virtual value that is not stored in the DB. This could for example be useful if you want to provide a default value in your model that is returned to the user but not stored in the DB.
 *
 * You could also use it to validate a value before permuting and storing it. Checking password length before hashing it for example:
 * ```js
 * class User extends Model {}
 * User.init({
 *   password_hash: DataTypes.STRING,
 *   password: {
 *    type: DataTypes.VIRTUAL,
 *    set (val) {
 *      this.setDataValue('password', val); // Remember to set the data value, otherwise it won't be validated
 *      this.setDataValue('password_hash', this.salt + val);
 *    },
 *    validate: {
 *      isLongEnough (val) {
 *        if (val.length < 7) {
 *          throw new Error("Please choose a longer password")
 *        }
 *      }
 *    }
 *   }
 * }, { sequelize });
 * ```
 *
 * VIRTUAL also takes a return type and dependency fields as arguments
 * If a virtual attribute is present in `attributes` it will automatically pull in the extra fields as well.
 * Return type is mostly useful for setups that rely on types like GraphQL.
 * ```js
 * {
 *   active: {
 *   type: new DataTypes.VIRTUAL(DataTypes.BOOLEAN, ['createdAt']),
 *   get() {
 *     return this.get('createdAt') > Date.now() - (7 * 24 * 60 * 60 * 1000)
 *   }
 *   }
 * }
 * ```
 *
 * In the above code the password is stored plainly in the password field so it can be validated, but is never stored in the DB.
 */
export const VIRTUAL: VirtualDataTypeConstructor;

interface VirtualDataTypeConstructor extends AbstractDataTypeConstructor {
  new <T extends AbstractDataTypeConstructor | AbstractDataType>(ReturnType: T, fields?: string[]): VirtualDataType<
    T
  >;
  <T extends AbstractDataTypeConstructor | AbstractDataType>(ReturnType: T, fields?: string[]): VirtualDataType<T>;
}

export interface VirtualDataType<T extends AbstractDataTypeConstructor | AbstractDataType> extends AbstractDataType {
  returnType: T;
  fields: string[];
}

/**
 * An enumeration. `DataTypes.ENUM('value', 'another value')`.
 */
export const ENUM: EnumDataTypeConstructor;

interface EnumDataTypeConstructor extends AbstractDataTypeConstructor {
  new <T extends string>(...values: T[]): EnumDataType<T>;
  new <T extends string>(options: EnumDataTypeOptions<T>): EnumDataType<T>;
  <T extends string>(...values: T[]): EnumDataType<T>;
  <T extends string>(options: EnumDataTypeOptions<T>): EnumDataType<T>;
}

export interface EnumDataType<T extends string> extends AbstractDataType {
  values: T[];
  options: EnumDataTypeOptions<T>;
}

export interface EnumDataTypeOptions<T extends string> {
  values: T[];
}

/**
 * An array of `type`, e.g. `DataTypes.ARRAY(DataTypes.DECIMAL)`. Only available in postgres.
 */
export const ARRAY: ArrayDataTypeConstructor;

interface ArrayDataTypeConstructor extends AbstractDataTypeConstructor {
  new <T extends AbstractDataTypeConstructor | AbstractDataType>(type: T): ArrayDataType<T>;
  new <T extends AbstractDataTypeConstructor | AbstractDataType>(options: ArrayDataTypeOptions<T>): ArrayDataType<T>;
  <T extends AbstractDataTypeConstructor | AbstractDataType>(type: T): ArrayDataType<T>;
  <T extends AbstractDataTypeConstructor | AbstractDataType>(options: ArrayDataTypeOptions<T>): ArrayDataType<T>;
  is<T extends AbstractDataTypeConstructor | AbstractDataType>(obj: unknown, type: T): obj is ArrayDataType<T>;
}

export interface ArrayDataType<T extends AbstractDataTypeConstructor | AbstractDataType> extends AbstractDataType {
  options: ArrayDataTypeOptions<T>;
}

export interface ArrayDataTypeOptions<T extends AbstractDataTypeConstructor | AbstractDataType> {
  type: T;
}

/**
 * A geometry datatype represents two dimensional spacial objects.
 */
export const GEOMETRY: GeometryDataTypeConstructor;

interface GeometryDataTypeConstructor extends AbstractDataTypeConstructor {
  new (type: string, srid?: number): GeometryDataType;
  new (options: GeometryDataTypeOptions): GeometryDataType;
  (type: string, srid?: number): GeometryDataType;
  (options: GeometryDataTypeOptions): GeometryDataType;
}

export interface GeometryDataType extends AbstractDataType {
  options: GeometryDataTypeOptions;
  type: string;
  srid?: number;
  escape: boolean;
}

export interface GeometryDataTypeOptions {
  type: string;
  srid?: number;
}

/**
 * A geography datatype represents two dimensional spacial objects in an elliptic coord system.
 */
export const GEOGRAPHY: GeographyDataTypeConstructor;

interface GeographyDataTypeConstructor extends AbstractDataTypeConstructor {
  new (type: string, srid?: number): GeographyDataType;
  new (options: GeographyDataTypeOptions): GeographyDataType;
  (type: string, srid?: number): GeographyDataType;
  (options: GeographyDataTypeOptions): GeographyDataType;
}

export interface GeographyDataType extends AbstractDataType {
  options: GeographyDataTypeOptions;
  type: string;
  srid?: number;
  escape: boolean;
}

export interface GeographyDataTypeOptions {
  type: string;
  srid?: number;
}

export const CIDR: AbstractDataTypeConstructor;

export const INET: AbstractDataTypeConstructor;

export const MACADDR: AbstractDataTypeConstructor;

/**
 * Case incenstive text
 */
export const CITEXT: AbstractDataTypeConstructor;

// umzug compatibility
export type DataTypeAbstract = AbstractDataTypeConstructor;
