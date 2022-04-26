'use strict';

const _ = require('lodash');
const wkx = require('wkx');

module.exports = BaseTypes => {
  const warn = BaseTypes.ABSTRACT.warn.bind(undefined, 'https://docs.yugabyte.com/latest/api/ysql/datatypes/');

  /**
   * Removes unsupported YugabyteDB options, i.e., LENGTH, UNSIGNED and ZEROFILL, for the integer data types.
   *
   * @param {object} dataType The base integer data type.
   * @private
   */
  function removeUnsupportedIntegerOptions(dataType) {
    if (dataType._length || dataType.options.length > 0 || dataType._unsigned || dataType._zerofill) {
      warn(`YugabyteDB does not support '${dataType.key}' with LENGTH, UNSIGNED or ZEROFILL. Plain '${dataType.key}' will be used instead.`);
      dataType._length = undefined;
      dataType.options.length = undefined;
      dataType._unsigned = undefined;
      dataType._zerofill = undefined;
    }
  }

  /**
   * types:
   * {
   *   oids: [oid],
   *   array_oids: [oid]
   * }
   *
   * @see oid here https://github.com/lib/pq/blob/master/oid/types.go
   */

  BaseTypes.UUID.types.yugabytedb = ['uuid'];
  BaseTypes.CIDR.types.yugabytedb = ['cidr'];
  BaseTypes.INET.types.yugabytedb = ['inet'];
  BaseTypes.MACADDR.types.yugabytedb = ['macaddr'];
  BaseTypes.TSVECTOR.types.yugabytedb = ['tsvector'];
  BaseTypes.JSON.types.yugabytedb = ['json'];
  BaseTypes.JSONB.types.yugabytedb = ['jsonb'];
  BaseTypes.TIME.types.yugabytedb = ['time'];

  class DATEONLY extends BaseTypes.DATEONLY {
    _stringify(value, options) {
      if (value === Number.POSITIVE_INFINITY) {
        return 'Infinity';
      }

      if (value === Number.NEGATIVE_INFINITY) {
        return '-Infinity';
      }

      return super._stringify(value, options);
    }

    _sanitize(value, options) {
      if ((!options || options && !options.raw) && value !== Number.POSITIVE_INFINITY && value !== Number.NEGATIVE_INFINITY) {
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          if (lower === 'infinity') {
            return Number.POSITIVE_INFINITY;
          }

          if (lower === '-infinity') {
            return Number.NEGATIVE_INFINITY;
          }
        }

        return super._sanitize(value);
      }

      return value;
    }

    static parse(value) {
      if (value === 'infinity') {
        return Number.POSITIVE_INFINITY;
      }

      if (value === '-infinity') {
        return Number.NEGATIVE_INFINITY;
      }

      return value;
    }
  }

  BaseTypes.DATEONLY.types.yugabytedb = ['date'];

  class DECIMAL extends BaseTypes.DECIMAL {}

  // numeric
  BaseTypes.DECIMAL.types.yugabytedb = ['numeric'];

  class STRING extends BaseTypes.STRING {
    toSql() {
      if (this._binary) {
        return 'BYTEA';
      }

      return super.toSql();
    }
  }

  BaseTypes.STRING.types.yugabytedb = ['varchar'];

  class TEXT extends BaseTypes.TEXT {
    toSql() {
      if (this._length) {
        warn('YugabyteDB does not support TEXT with options. Plain `TEXT` will be used instead.');
        this._length = undefined;
      }

      return 'TEXT';
    }
  }

  BaseTypes.TEXT.types.yugabytedb = ['text'];

  class CITEXT extends BaseTypes.CITEXT {
    static parse(value) {
      return value;
    }
  }

  BaseTypes.CITEXT.types.yugabytedb = ['citext'];

  class CHAR extends BaseTypes.CHAR {
    toSql() {
      if (this._binary) {
        return 'BYTEA';
      }

      return super.toSql();
    }
  }

  BaseTypes.CHAR.types.yugabytedb = ['char', 'bpchar'];

  class BOOLEAN extends BaseTypes.BOOLEAN {
    toSql() {
      return 'BOOLEAN';
    }

    _sanitize(value) {
      if (value !== null && value !== undefined) {
        if (Buffer.isBuffer(value) && value.length === 1) {
          // Bit fields are returned as buffers
          value = value[0];
        }

        if (typeof value === 'string') {
          // Only take action on valid boolean strings.
          return ['true', 't'].includes(value) ? true : ['false', 'f'].includes(value) ? false : value;
        }

        if (typeof value === 'number') {
          // Only take action on valid boolean integers.
          return value === 1 ? true : value === 0 ? false : value;
        }
      }

      return value;
    }
  }

  BOOLEAN.parse = BOOLEAN.prototype._sanitize;

  BaseTypes.BOOLEAN.types.yugabytedb = ['bool'];

  class DATE extends BaseTypes.DATE {
    toSql() {
      return 'TIMESTAMP WITH TIME ZONE';
    }

    validate(value) {
      if (value !== Number.POSITIVE_INFINITY && value !== Number.NEGATIVE_INFINITY) {
        return super.validate(value);
      }

      return true;
    }

    _stringify(value, options) {
      if (value === Number.POSITIVE_INFINITY) {
        return 'Infinity';
      }

      if (value === Number.NEGATIVE_INFINITY) {
        return '-Infinity';
      }

      return super._stringify(value, options);
    }

    _sanitize(value, options) {
      if ((!options || options && !options.raw) && !(value instanceof Date) && Boolean(value) && value !== Number.POSITIVE_INFINITY && value !== Number.NEGATIVE_INFINITY) {
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          if (lower === 'infinity') {
            return Number.POSITIVE_INFINITY;
          }

          if (lower === '-infinity') {
            return Number.NEGATIVE_INFINITY;
          }
        }

        return new Date(value);
      }

      return value;
    }
  }

  BaseTypes.DATE.types.yugabytedb = ['timestamptz'];

  class TINYINT extends BaseTypes.TINYINT {
    constructor(length) {
      super(length);
      removeUnsupportedIntegerOptions(this);
    }
  }

  // int2
  BaseTypes.TINYINT.types.yugabytedb = ['int2'];

  class SMALLINT extends BaseTypes.SMALLINT {
    constructor(length) {
      super(length);
      removeUnsupportedIntegerOptions(this);
    }
  }

  // int2
  BaseTypes.SMALLINT.types.yugabytedb = ['int2'];

  class INTEGER extends BaseTypes.INTEGER {
    constructor(length) {
      super(length);
      removeUnsupportedIntegerOptions(this);
    }
  }

  INTEGER.parse = function parse(value) {
    return Number.parseInt(value, 10);
  };

  // int4
  BaseTypes.INTEGER.types.yugabytedb = ['int4'];

  class BIGINT extends BaseTypes.BIGINT {
    constructor(length) {
      super(length);
      removeUnsupportedIntegerOptions(this);
    }
  }

  // int8
  BaseTypes.BIGINT.types.yugabytedb = ['int8'];

  class REAL extends BaseTypes.REAL {
    constructor(length) {
      super(length);
      removeUnsupportedIntegerOptions(this);
    }
  }

  // float4
  BaseTypes.REAL.types.yugabytedb = ['float4'];

  class DOUBLE extends BaseTypes.DOUBLE {
    constructor(length) {
      super(length);
      removeUnsupportedIntegerOptions(this);
    }
  }

  // float8
  BaseTypes.DOUBLE.types.yugabytedb = ['float8'];

  class FLOAT extends BaseTypes.FLOAT {
    constructor(length, decimals) {
      super(length, decimals);
      if (this._decimals) {
        warn('YugabyteDB does not support FLOAT with decimals. Plain `FLOAT` will be used instead.');
        this._length = undefined;
        this.options.length = undefined;
        this._decimals = undefined;
      }

      if (this._unsigned) {
        warn('YugabyteDB does not support FLOAT unsigned. `UNSIGNED` was removed.');
        this._unsigned = undefined;
      }

      if (this._zerofill) {
        warn('YugabyteDB does not support FLOAT zerofill. `ZEROFILL` was removed.');
        this._zerofill = undefined;
      }
    }
  }

  delete FLOAT.parse; // Float has no separate type in PG

  class BLOB extends BaseTypes.BLOB {
    toSql() {
      if (this._length) {
        warn('YugabyteDB does not support BLOB (BYTEA) with options. Plain `BYTEA` will be used instead.');
        this._length = undefined;
      }

      return 'BYTEA';
    }

    _hexify(hex) {
      return `E'\\\\x${hex}'`;
    }
  }

  BaseTypes.BLOB.types.yugabytedb = ['bytea'];

  class GEOMETRY extends BaseTypes.GEOMETRY {
    toSql() {
      let result = this.key;
      if (this.type) {
        result += `(${this.type}`;
        if (this.srid) {
          result += `,${this.srid}`;
        }

        result += ')';
      }

      return result;
    }

    static parse(value) {
      const b = Buffer.from(value, 'hex');

      return wkx.Geometry.parse(b).toGeoJSON({ shortCrs: true });
    }

    _stringify(value, options) {
      return `ST_GeomFromGeoJSON(${options.escape(JSON.stringify(value))})`;
    }

    _bindParam(value, options) {
      return `ST_GeomFromGeoJSON(${options.bindParam(value)})`;
    }
  }

  BaseTypes.GEOMETRY.types.yugabytedb = ['geometry'];

  class GEOGRAPHY extends BaseTypes.GEOGRAPHY {
    toSql() {
      let result = 'GEOGRAPHY';
      if (this.type) {
        result += `(${this.type}`;
        if (this.srid) {
          result += `,${this.srid}`;
        }

        result += ')';
      }

      return result;
    }

    static parse(value) {
      const b = Buffer.from(value, 'hex');

      return wkx.Geometry.parse(b).toGeoJSON({ shortCrs: true });
    }

    _stringify(value, options) {
      return `ST_GeomFromGeoJSON(${options.escape(JSON.stringify(value))})`;
    }

    bindParam(value, options) {
      return `ST_GeomFromGeoJSON(${options.bindParam(value)})`;
    }
  }

  BaseTypes.GEOGRAPHY.types.yugabytedb = ['geography'];

  let hstore;

  class HSTORE extends BaseTypes.HSTORE {
    constructor() {
      super();
      if (!hstore) {
        // All datatype files are loaded at import - make sure we don't load the hstore parser before a hstore is instantiated
        hstore = require('../postgres/hstore');
      }
    }

    _value(value) {
      if (!hstore) {
        // All datatype files are loaded at import - make sure we don't load the hstore parser before a hstore is instantiated
        hstore = require('../postgres/hstore');
      }

      return hstore.stringify(value);
    }

    _stringify(value) {
      return `'${this._value(value)}'`;
    }

    _bindParam(value, options) {
      return options.bindParam(this._value(value));
    }

    static parse(value) {
      if (!hstore) {
        // All datatype files are loaded at import - make sure we don't load the hstore parser before a hstore is instantiated
        hstore = require('../postgres/hstore');
      }

      return hstore.parse(value);
    }
  }

  HSTORE.prototype.escape = false;

  BaseTypes.HSTORE.types.yugabytedb = ['hstore'];

  class RANGE extends BaseTypes.RANGE {
    _value(values, options) {
      if (!Array.isArray(values)) {
        return this.options.subtype.stringify(values, options);
      }

      const valueInclusivity = [true, false];
      const valuesStringified = values.map((value, index) => {
        if (_.isObject(value) && Object.prototype.hasOwnProperty.call(value, 'value')) {
          if (Object.prototype.hasOwnProperty.call(value, 'inclusive')) {
            valueInclusivity[index] = value.inclusive;
          }

          value = value.value;
        }

        if (value === null || value === Number.NEGATIVE_INFINITY || value === Number.POSITIVE_INFINITY) {
          // Pass through "unbounded" bounds unchanged
          return value;
        }

        if (this.options.subtype.stringify) {
          return this.options.subtype.stringify(value, options);
        }

        return options.escape(value);
      });
      // Array.map does not preserve extra array properties
      valuesStringified.inclusive = valueInclusivity;

      return range.stringify(valuesStringified);
    }

    _stringify(values, options) {
      const value = this._value(values, options);
      if (!Array.isArray(values)) {
        return `'${value}'::${this.toCastType()}`;
      }

      return `'${value}'`;
    }

    _bindParam(values, options) {
      const value = this._value(values, options);
      if (!Array.isArray(values)) {
        return `${options.bindParam(value)}::${this.toCastType()}`;
      }

      return options.bindParam(value);
    }

    toSql() {
      return BaseTypes.RANGE.types.yugabytedb.subtypes[this._subtype.toLowerCase()];
    }

    toCastType() {
      return BaseTypes.RANGE.types.yugabytedb.castTypes[this._subtype.toLowerCase()];
    }

    static parse(value, options = { parser: val => val }) {
      return range.parse(value, options.parser);
    }
  }

  const range = require('../postgres/range');

  RANGE.prototype.escape = false;

  BaseTypes.RANGE.types.yugabytedb = {
    subtypes: {
      integer: 'int4range',
      decimal: 'numrange',
      date: 'tstzrange',
      dateonly: 'daterange',
      bigint: 'int8range',
    },
    castTypes: {
      integer: 'int4',
      decimal: 'numeric',
      date: 'timestamptz',
      dateonly: 'date',
      bigint: 'int8',
    },
  };

  // TODO: Why are base types being manipulated??
  BaseTypes.ARRAY.prototype.escape = false;
  BaseTypes.ARRAY.prototype._value = function _value(values, options) {
    return values.map(value => {
      if (options && options.bindParam && this.type && this.type._value) {
        return this.type._value(value, options);
      }

      if (this.type && this.type.stringify) {
        value = this.type.stringify(value, options);

        if (this.type.escape === false) {
          return value;
        }
      }

      return options.escape(value);
    });
  };

  BaseTypes.ARRAY.prototype._stringify = function _stringify(values, options) {
    let str = `ARRAY[${this._value(values, options).join(',')}]`;

    if (this.type) {
      const Utils = require('../../utils');
      let castKey = this.toSql();

      if (this.type instanceof BaseTypes.ENUM) {
        const table = options.field.Model.getTableName();
        const useSchema = table.schema !== undefined;
        const schemaWithDelimiter = useSchema ? `${Utils.addTicks(table.schema, '"')}${table.delimiter}` : '';

        castKey = `${Utils.addTicks(
          Utils.generateEnumName(useSchema ? table.tableName : table, options.field.field),
          '"',
        )}[]`;

        str += `::${schemaWithDelimiter}${castKey}`;
      } else {
        str += `::${castKey}`;
      }
    }

    return str;
  };

  BaseTypes.ARRAY.prototype._bindParam = function _bindParam(values, options) {
    return options.bindParam(this._value(values, options));
  };

  class ENUM extends BaseTypes.ENUM {
    static parse(value) {
      return value;
    }
  }

  BaseTypes.ENUM.types.yugabytedb = [null];

  return {
    DECIMAL,
    BLOB,
    STRING,
    CHAR,
    TEXT,
    TINYINT,
    SMALLINT,
    INTEGER,
    BIGINT,
    BOOLEAN,
    DATE,
    DATEONLY,
    REAL,
    'DOUBLE PRECISION': DOUBLE,
    FLOAT,
    HSTORE,
    RANGE,
    ENUM,
    CITEXT,
    GEOGRAPHY,
    GEOMETRY,
  };
};

