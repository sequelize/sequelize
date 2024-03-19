import * as PgDataTypes from './extra-data-types.js';
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export declare const HSTORE: typeof PgDataTypes.HSTORE & (() => PgDataTypes.HSTORE);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export declare const RANGE: typeof PgDataTypes.RANGE & ((subtypeOrOptions: import("packages/core/lib/index.js").DataTypeClassOrInstance | import("packages/core/lib/index.js").RangeOptions) => PgDataTypes.RANGE<import("packages/core/lib/dialects/abstract/data-types.js").DATE | import("packages/core/lib/dialects/abstract/data-types.js").DATEONLY | import("packages/core/lib/dialects/abstract/data-types.js").BaseNumberDataType<import("packages/core/lib/index.js").NumberOptions>>);
