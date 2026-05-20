import type { AbstractDialect } from '@sequelize/core';
import { ValidationErrorItem } from '@sequelize/core';
import type { AcceptedDate } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import * as BaseTypes from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import maxBy from 'lodash/maxBy.js';
import util from 'node:util';

export type SnowflakeVectorFormat = 'INT' | 'FLOAT';

export interface SnowflakeVectorOptions {
  dimension: number;
  format: SnowflakeVectorFormat;
}

export class DATE extends BaseTypes.DATE {
  toSql() {
    return `TIMESTAMP${this.options.precision != null ? `(${this.options.precision})` : ''}`;
  }

  toBindableValue(date: AcceptedDate) {
    date = this._applyTimezone(date);

    return date.format('YYYY-MM-DD HH:mm:ss.SSS');
  }
}

export class UUID extends BaseTypes.UUID {
  toSql() {
    // https://community.snowflake.com/s/question/0D50Z00009LH2fl/what-is-the-best-way-to-store-uuids
    return 'VARCHAR(36)';
  }
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  toSql() {
    const minLength = maxBy(this.options.values, value => value.length)?.length ?? 0;

    // db2 does not have an ENUM type, we use VARCHAR instead.
    return `VARCHAR(${Math.max(minLength, 255)})`;
  }
}

export class TEXT extends BaseTypes.TEXT {
  toSql() {
    return 'TEXT';
  }
}

/** @deprecated */
export class REAL extends BaseTypes.REAL {
  toSql(): string {
    return 'REAL';
  }
}

export class FLOAT extends BaseTypes.FLOAT {
  // TODO: warn that FLOAT is not supported in Snowflake, only DOUBLE is

  toSql(): string {
    return 'FLOAT';
  }
}

export class DOUBLE extends BaseTypes.DOUBLE {
  toSql(): string {
    // FLOAT is a double-precision floating point in Snowflake
    return 'FLOAT';
  }
}

// Snowflake only has one int type: Integer, which is -99999999999999999999999999999999999999 to 99999999999999999999999999999999999999
export class TINYINT extends BaseTypes.TINYINT {
  toSql() {
    return 'INTEGER';
  }
}

export class SMALLINT extends BaseTypes.SMALLINT {
  toSql() {
    return 'INTEGER';
  }
}

export class MEDIUMINT extends BaseTypes.MEDIUMINT {
  toSql() {
    return 'INTEGER';
  }
}

export class INTEGER extends BaseTypes.INTEGER {
  toSql() {
    return 'INTEGER';
  }
}

export class BIGINT extends BaseTypes.BIGINT {
  // not really true, but snowflake allows INT values up to 99999999999999999999999999999999999999,
  // which is more than enough to cover a 64-bit unsigned integer (0 - 18446744073709551615)
  protected _supportsNativeUnsigned(_dialect: AbstractDialect): boolean {
    return true;
  }

  toSql() {
    return 'INTEGER';
  }
}

export class VECTOR extends BaseTypes.VECTOR {
  protected _getSqlOptionParts(): string[] {
    const options = this.#getSnowflakeOptions();

    return [options.format, String(options.dimension)];
  }

  validate(value: unknown): asserts value is BaseTypes.VectorValue {
    super.validate(value);
    const options = this.#getSnowflakeOptions();

    const length = this.#getVectorLength(value);
    if (length !== options.dimension) {
      ValidationErrorItem.throwDataTypeValidationError(
        util.format(
          'VECTOR expects values of length %d, but received %d',
          options.dimension,
          length,
        ),
      );
    }
  }

  protected _validateFormat(format: string): SnowflakeVectorFormat {
    const normalized = format.trim().toUpperCase();

    switch (normalized) {
      case 'INT':
      case 'INT8':
      case 'INT16':
      case 'INT32':
        return 'INT';
      case 'FLOAT':
      case 'FLOAT32':
      case 'FLOAT64':
        return 'FLOAT';
      default:
        throw new TypeError(`Invalid Snowflake VECTOR format: ${format}`);
    }
  }

  #getVectorLength(value: BaseTypes.VectorValue): number {
    if (Array.isArray(value)) {
      return value.length;
    }

    return value.length;
  }

  #getSnowflakeOptions(): SnowflakeVectorOptions {
    if (this.options.dimension == null) {
      throw new TypeError('Snowflake VECTOR requires a positive integer "dimension" option.');
    }

    const dimension = this._validateDimension(this.options.dimension, 4096);
    const format = this._validateFormat(this.options.format ?? 'FLOAT');

    return { dimension, format };
  }
}
