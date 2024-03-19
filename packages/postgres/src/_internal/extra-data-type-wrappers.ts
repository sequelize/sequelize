import { classToInvokable } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/class-to-invokable.js';
import * as PgDataTypes from './extra-data-types.js';

/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const HSTORE = classToInvokable(PgDataTypes.HSTORE);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const RANGE = classToInvokable(PgDataTypes.RANGE);
