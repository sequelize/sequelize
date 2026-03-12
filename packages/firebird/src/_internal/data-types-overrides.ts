/**
 * Firebird data type overrides.
 *
 * Each export overrides the corresponding Sequelize abstract type with a
 * Firebird-native SQL representation.
 *
 * Firebird type reference:
 * https://firebirdsql.org/refdocs/langrefupd25-datatypes.html
 */
import * as BaseTypes from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import type { AcceptedDate } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import dayjs from 'dayjs';

// ── String ────────────────────────────────────────────────────────────────────

export class STRING extends BaseTypes.STRING {
  toSql(): string {
    if (this.options.binary) {
      return `CHAR(${this.options.length ?? 255}) CHARACTER SET OCTETS`;
    }

    return `VARCHAR(${this.options.length ?? 255})`;
  }
}

export class TEXT extends BaseTypes.TEXT {
  toSql(): string {
    // Firebird has no TEXT column; BLOB SUB_TYPE TEXT is the idiomatic choice.
    return 'BLOB SUB_TYPE TEXT';
  }
}

export class CHAR extends BaseTypes.CHAR {
  toSql(): string {
    return `CHAR(${this.options.length ?? 1})`;
  }
}

// ── Numeric ───────────────────────────────────────────────────────────────────

export class TINYINT extends BaseTypes.TINYINT {
  toSql(): string {
    // Firebird has no TINYINT; SMALLINT is the smallest integer type.
    return 'SMALLINT';
  }
}

export class SMALLINT extends BaseTypes.SMALLINT {
  toSql(): string {
    return 'SMALLINT';
  }
}

export class MEDIUMINT extends BaseTypes.MEDIUMINT {
  toSql(): string {
    // Firebird has no MEDIUMINT.
    return 'INTEGER';
  }
}

export class INTEGER extends BaseTypes.INTEGER {
  toSql(): string {
    return 'INTEGER';
  }
}

export class BIGINT extends BaseTypes.BIGINT {
  toSql(): string {
    return 'BIGINT';
  }
}

export class FLOAT extends BaseTypes.FLOAT {
  toSql(): string {
    return 'FLOAT';
  }
}

export class REAL extends BaseTypes.REAL {
  toSql(): string {
    return 'FLOAT';
  }
}

export class DOUBLE extends BaseTypes.DOUBLE {
  toSql(): string {
    return 'DOUBLE PRECISION';
  }
}

export class DECIMAL extends BaseTypes.DECIMAL {
  toSql(): string {
    const { precision, scale } = this.options;
    if (precision != null && scale != null) {
      return `DECIMAL(${precision},${scale})`;
    }

    if (precision != null) {
      return `DECIMAL(${precision})`;
    }

    return 'DECIMAL(18,4)';
  }
}

// ── Boolean ───────────────────────────────────────────────────────────────────

export class BOOLEAN extends BaseTypes.BOOLEAN {
  toSql(): string {
    // Native BOOLEAN available since Firebird 3.0
    return 'BOOLEAN';
  }

  escape(value: boolean | unknown, _options?: any): string {
    return value ? 'TRUE' : 'FALSE';
  }
}

// ── Date / Time ───────────────────────────────────────────────────────────────

export class DATE extends BaseTypes.DATE {
  toSql(): string {
    // Firebird TIMESTAMP = date + time
    return 'TIMESTAMP';
  }

  stringify(value: AcceptedDate): string {
    const d = dayjs(this.sanitize(value) as Date | dayjs.Dayjs);

    return d.format('YYYY-MM-DD HH:mm:ss.SSS');
  }
}

export class DATEONLY extends BaseTypes.DATEONLY {
  toSql(): string {
    return 'DATE';
  }
}

export class TIME extends BaseTypes.TIME {
  toSql(): string {
    return 'TIME';
  }
}

// ── UUID ──────────────────────────────────────────────────────────────────────

export class UUID extends BaseTypes.UUID {
  toSql(): string {
    // Firebird has no native UUID column type; CHAR(36) is the standard workaround.
    return 'CHAR(36)';
  }
}

// ── Binary ────────────────────────────────────────────────────────────────────

export class BLOB extends BaseTypes.BLOB {
  toSql(): string {
    return 'BLOB';
  }
}

// ── JSON ──────────────────────────────────────────────────────────────────────

export class JSON extends BaseTypes.JSON {
  toSql(): string {
    // Firebird has no native JSON type; store as BLOB SUB_TYPE TEXT.
    return 'BLOB SUB_TYPE TEXT';
  }
}
