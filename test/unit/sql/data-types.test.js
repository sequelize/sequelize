import Support from '../support.js';
import DataTypes from '../../../lib/data-types.js';
import * as chai from 'chai';
import { format } from 'node:util';
import * as uuid from 'uuid';

const Sequelize = Support.Sequelize;

const expectsql = Support.expectsql;
const current = Support.sequelize;
const expect = chai.expect;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('DataTypes', () => {
    const testsql = function (description, dataType, expectation) {
      it(description, () => {
        return expectsql(current.normalizeDataType(dataType).toSql(), expectation);
      });
    };

    describe('STRING', () => {
      testsql('STRING', DataTypes.STRING, {
        default: 'VARCHAR(255)'
      });

      testsql('STRING(1234)', DataTypes.STRING(1234), {
        default: 'VARCHAR(1234)'
      });

      testsql('STRING({ length: 1234 })', DataTypes.STRING({ length: 1234 }), {
        default: 'VARCHAR(1234)'
      });

      testsql('STRING(1234).BINARY', DataTypes.STRING(1234).BINARY, {
        default: 'VARCHAR(1234) BINARY',
        postgres: 'BYTEA'
      });

      testsql('STRING.BINARY', DataTypes.STRING.BINARY, {
        default: 'VARCHAR(255) BINARY',
        postgres: 'BYTEA'
      });

      describe('validate', () => {
        it('should return `true` if `value` is a string', () => {
          const type = DataTypes.STRING();

          expect(type.validate('foobar')).to.equal(true);
          expect(type.validate(new String('foobar'))).to.equal(true);
          expect(type.validate(12)).to.equal(true);
        });
      });
    });

    describe('TEXT', () => {
      testsql('TEXT', DataTypes.TEXT, {
        default: 'TEXT'
      });

      testsql('TEXT("tiny")', DataTypes.TEXT('tiny'), {
        default: 'TEXT'
      });

      testsql('TEXT({ length: "tiny" })', DataTypes.TEXT({ length: 'tiny' }), {
        default: 'TEXT'
      });

      testsql('TEXT("medium")', DataTypes.TEXT('medium'), {
        default: 'TEXT'
      });

      testsql('TEXT("long")', DataTypes.TEXT('long'), {
        default: 'TEXT'
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.TEXT();

          expect(() => {
            type.validate(12345);
          }).to.throw(Sequelize.ValidationError, '12345 is not a valid string');
        });

        it('should return `true` if `value` is a string', () => {
          const type = DataTypes.TEXT();

          expect(type.validate('foobar')).to.equal(true);
        });
      });
    });

    describe('CHAR', () => {
      testsql('CHAR', DataTypes.CHAR, {
        default: 'CHAR(255)'
      });

      testsql('CHAR(12)', DataTypes.CHAR(12), {
        default: 'CHAR(12)'
      });

      testsql('CHAR({ length: 12 })', DataTypes.CHAR({ length: 12 }), {
        default: 'CHAR(12)'
      });

      testsql('CHAR(12).BINARY', DataTypes.CHAR(12).BINARY, {
        default: 'CHAR(12) BINARY',
        postgres: 'BYTEA'
      });

      testsql('CHAR.BINARY', DataTypes.CHAR.BINARY, {
        default: 'CHAR(255) BINARY',
        postgres: 'BYTEA'
      });
    });

    describe('BOOLEAN', () => {
      testsql('BOOLEAN', DataTypes.BOOLEAN, {
        postgres: 'BOOLEAN'
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.BOOLEAN();

          expect(() => {
            type.validate(12345);
          }).to.throw(Sequelize.ValidationError, '12345 is not a valid boolean');
        });

        it('should return `true` if `value` is a boolean', () => {
          const type = DataTypes.BOOLEAN();

          expect(type.validate(true)).to.equal(true);
          expect(type.validate(false)).to.equal(true);
          expect(type.validate('1')).to.equal(true);
          expect(type.validate('0')).to.equal(true);
          expect(type.validate('true')).to.equal(true);
          expect(type.validate('false')).to.equal(true);
        });
      });
    });

    describe('DATE', () => {
      testsql('DATE', DataTypes.DATE, {
        postgres: 'TIMESTAMP WITH TIME ZONE'
      });

      testsql('DATE(6)', DataTypes.DATE(6), {
        postgres: 'TIMESTAMP WITH TIME ZONE'
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.DATE();

          expect(() => {
            type.validate('foobar');
          }).to.throw(Sequelize.ValidationError, '"foobar" is not a valid date');
        });

        it('should return `true` if `value` is a date', () => {
          const type = DataTypes.DATE();

          expect(type.validate(new Date())).to.equal(true);
        });
      });

      describe('stringify', () => {
        // [instant, options.timezone, expected]. Expectations are hardcoded rather than
        // derived from a date library, so this suite is an independent oracle for the
        // timezone handling in DATE._applyTimezone.
        const cases = [
          ['2015-01-20T00:00:00.000Z', '+00:00', '2015-01-20 00:00:00.000 +00:00'],
          ['2015-01-20T00:00:00.000Z', '-07:00', '2015-01-19 17:00:00.000 -07:00'],
          ['2015-01-20T00:00:00.000Z', '+05:30', '2015-01-20 05:30:00.000 +05:30'],
          ['2015-01-20T00:00:00.000Z', '+05:45', '2015-01-20 05:45:00.000 +05:45'],
          ['2015-01-20T01:02:03.089Z', '+00:00', '2015-01-20 01:02:03.089 +00:00'],

          // Named zones, including ones whose offset is not a whole number of hours
          ['2015-01-20T00:00:00.000Z', 'UTC', '2015-01-20 00:00:00.000 +00:00'],
          ['2015-01-20T00:00:00.000Z', 'CET', '2015-01-20 01:00:00.000 +01:00'],
          ['2015-01-20T00:00:00.000Z', 'Asia/Kathmandu', '2015-01-20 05:45:00.000 +05:45'],

          // A named zone must track DST rather than pick one fixed offset
          ['2015-01-20T00:00:00.000Z', 'America/New_York', '2015-01-19 19:00:00.000 -05:00'],
          ['2015-07-20T00:00:00.000Z', 'America/New_York', '2015-07-19 20:00:00.000 -04:00'],
          ['2015-01-20T00:00:00.000Z', 'Australia/Lord_Howe', '2015-01-20 11:00:00.000 +11:00'],
          ['2015-07-20T00:00:00.000Z', 'Australia/Lord_Howe', '2015-07-20 10:30:00.000 +10:30'],

          // Either side of a spring-forward gap and a fall-back repeated hour
          ['2015-03-08T08:59:59.999Z', 'America/Denver', '2015-03-08 01:59:59.999 -07:00'],
          ['2015-03-08T09:00:00.000Z', 'America/Denver', '2015-03-08 03:00:00.000 -06:00'],
          ['2015-11-01T07:59:59.999Z', 'America/Denver', '2015-11-01 01:59:59.999 -06:00'],
          ['2015-11-01T08:00:00.000Z', 'America/Denver', '2015-11-01 01:00:00.000 -07:00']
        ];

        for (const [instant, timezone, expected] of cases) {
          it(`formats ${instant} in ${timezone}`, () => {
            expect(DataTypes.DATE().stringify(new Date(instant), { timezone })).to.equal(expected);
          });
        }

        // Catches a wall-clock that disagrees with the offset it is labelled with,
        // including a sign flip, without depending on the machine's own timezone.
        it('emits a wall clock and offset that round-trip to the original instant', () => {
          for (const [instant, timezone] of cases) {
            const stringified = DataTypes.DATE().stringify(new Date(instant), { timezone });
            const parsed = Date.parse(stringified.replace(' ', 'T').replace(' ', ''));

            expect(parsed, `${instant} in ${timezone} (${stringified})`).to.equal(Date.parse(instant));
          }
        });

        // A where clause on a DATE column reaches stringify without passing through
        // _sanitize, so strings and epoch numbers arrive uncoerced.
        describe('values that have not been sanitized to a Date', () => {
          const stringify = (value) => DataTypes.DATE().stringify(value, { timezone: 'America/Denver' });

          // These inputs name an absolute instant, so their rendering does not depend
          // on the host's timezone and can be asserted literally.
          it('accepts an instant that carries its own offset', () => {
            expect(stringify('2000-12-16T10:00:00Z')).to.equal('2000-12-16 03:00:00.000 -07:00');
            expect(stringify(1000000000000)).to.equal('2001-09-08 19:46:40.000 -06:00');
          });

          // These are read in local time, so a literal expectation would only hold on
          // the timezone it was recorded in. Asserting against the equivalent locally
          // constructed Date pins the same behaviour on any host: a bare date must mean
          // local midnight, where `new Date` would read it as UTC midnight and shift the
          // query by the host's offset.
          it('reads a bare date as local midnight', () => {
            expect(stringify('2000-12-16')).to.equal(stringify(new Date(2000, 11, 16)));
          });

          it('reads an offsetless datetime as local time', () => {
            expect(stringify('2000-12-16T10:00:00')).to.equal(stringify(new Date(2000, 11, 16, 10, 0, 0)));
          });
        });

        it('falls back to the local offset when no timezone is configured', () => {
          const date = new Date('2015-01-20T00:00:00.000Z');
          const stringified = DataTypes.DATE().stringify(date, {});
          const parsed = Date.parse(stringified.replace(' ', 'T').replace(' ', ''));

          expect(parsed).to.equal(date.getTime());
          expect(stringified).to.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} [+-]\d{2}:\d{2}$/);
        });
      });
    });

    describe('DATEONLY', () => {
      describe('stringify', () => {
        it('passes through a bare YYYY-MM-DD string unshifted', () => {
          // `new Date('2011-10-31')` parses as UTC midnight, which renders as the
          // previous day anywhere west of UTC. The day must survive verbatim.
          expect(DataTypes.DATEONLY().stringify('2011-10-31')).to.equal('2011-10-31');
        });

        it('formats a Date in local time', () => {
          expect(DataTypes.DATEONLY().stringify(new Date(2011, 9, 31))).to.equal('2011-10-31');
          expect(DataTypes.DATEONLY().stringify(new Date(2011, 9, 31, 23, 59, 59))).to.equal('2011-10-31');
          expect(DataTypes.DATEONLY().stringify(new Date(2011, 9, 31, 0, 0, 0))).to.equal('2011-10-31');
        });

        it('formats a datetime string in local time', () => {
          expect(DataTypes.DATEONLY().stringify('2011-10-31T10:00:00')).to.equal('2011-10-31');
        });
      });

      describe('sanitize', () => {
        it('passes through a bare YYYY-MM-DD string unshifted', () => {
          expect(DataTypes.DATEONLY()._sanitize('2011-10-31')).to.equal('2011-10-31');
        });

        it('reduces a Date to its local calendar day', () => {
          expect(DataTypes.DATEONLY()._sanitize(new Date(2011, 9, 31, 23, 59, 59))).to.equal('2011-10-31');
        });

        it('leaves the value alone when raw', () => {
          const date = new Date(2011, 9, 31);

          expect(DataTypes.DATEONLY()._sanitize(date, { raw: true })).to.equal(date);
        });
      });
    });

    if (current.dialect.supports.HSTORE) {
      describe('HSTORE', () => {
        describe('validate', () => {
          it('should throw an error if `value` is invalid', () => {
            const type = DataTypes.HSTORE();

            expect(() => {
              type.validate('foobar');
            }).to.throw(Sequelize.ValidationError, '"foobar" is not a valid hstore');
          });

          it('should return `true` if `value` is an hstore', () => {
            const type = DataTypes.HSTORE();

            expect(type.validate({ foo: 'bar' })).to.equal(true);
          });
        });
      });
    }

    describe('UUID', () => {
      testsql('UUID', DataTypes.UUID, {
        postgres: 'UUID'
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.UUID();

          expect(() => {
            type.validate('foobar');
          }).to.throw(Sequelize.ValidationError, '"foobar" is not a valid uuid');

          expect(() => {
            type.validate(['foobar']);
          }).to.throw(Sequelize.ValidationError, '["foobar"] is not a valid uuid');
        });

        it('should return `true` if `value` is an uuid', () => {
          const type = DataTypes.UUID();

          expect(type.validate(uuid.v4())).to.equal(true);
        });

        it('should return `true` if `value` is a string and we accept strings', () => {
          const type = DataTypes.UUID();

          expect(type.validate('foobar', { acceptStrings: true })).to.equal(true);
        });
      });
    });

    describe('UUIDV1', () => {
      testsql('UUIDV1', DataTypes.UUIDV1, {
        default: 'UUIDV1'
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.UUIDV1();

          expect(() => {
            type.validate('foobar');
          }).to.throw(Sequelize.ValidationError, '"foobar" is not a valid uuid');

          expect(() => {
            type.validate(['foobar']);
          }).to.throw(Sequelize.ValidationError, '["foobar"] is not a valid uuid');
        });

        it('should return `true` if `value` is an uuid', () => {
          const type = DataTypes.UUIDV1();

          expect(type.validate(uuid.v1())).to.equal(true);
        });

        it('should return `true` if `value` is a string and we accept strings', () => {
          const type = DataTypes.UUIDV1();

          expect(type.validate('foobar', { acceptStrings: true })).to.equal(true);
        });
      });
    });

    describe('UUIDV4', () => {
      testsql('UUIDV4', DataTypes.UUIDV4, {
        default: 'UUIDV4'
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.UUIDV4();
          const value = uuid.v1();

          expect(() => {
            type.validate(value);
          }).to.throw(Sequelize.ValidationError, format('%j is not a valid uuidv4', value));

          expect(() => {
            type.validate(['foobar']);
          }).to.throw(Sequelize.ValidationError, '["foobar"] is not a valid uuidv4');
        });

        it('should return `true` if `value` is an uuid', () => {
          const type = DataTypes.UUIDV4();

          expect(type.validate(uuid.v4())).to.equal(true);
        });

        it('should return `true` if `value` is a string and we accept strings', () => {
          const type = DataTypes.UUIDV4();

          expect(type.validate('foobar', { acceptStrings: true })).to.equal(true);
        });
      });
    });

    describe('NOW', () => {
      testsql('NOW', DataTypes.NOW, {
        default: 'NOW'
      });
    });

    describe('INTEGER', () => {
      testsql('INTEGER', DataTypes.INTEGER, {
        default: 'INTEGER'
      });

      testsql('INTEGER.UNSIGNED', DataTypes.INTEGER.UNSIGNED, {
        default: 'INTEGER UNSIGNED',
        postgres: 'INTEGER'
      });

      testsql('INTEGER.UNSIGNED.ZEROFILL', DataTypes.INTEGER.UNSIGNED.ZEROFILL, {
        default: 'INTEGER UNSIGNED ZEROFILL',
        postgres: 'INTEGER'
      });

      testsql('INTEGER(11)', DataTypes.INTEGER(11), {
        default: 'INTEGER(11)',
        postgres: 'INTEGER'
      });

      testsql('INTEGER({ length: 11 })', DataTypes.INTEGER({ length: 11 }), {
        default: 'INTEGER(11)',
        postgres: 'INTEGER'
      });

      testsql('INTEGER(11).UNSIGNED', DataTypes.INTEGER(11).UNSIGNED, {
        default: 'INTEGER(11) UNSIGNED',
        postgres: 'INTEGER'
      });

      testsql('INTEGER(11).UNSIGNED.ZEROFILL', DataTypes.INTEGER(11).UNSIGNED.ZEROFILL, {
        default: 'INTEGER(11) UNSIGNED ZEROFILL',
        postgres: 'INTEGER'
      });

      testsql('INTEGER(11).ZEROFILL', DataTypes.INTEGER(11).ZEROFILL, {
        default: 'INTEGER(11) ZEROFILL',
        postgres: 'INTEGER'
      });

      testsql('INTEGER(11).ZEROFILL.UNSIGNED', DataTypes.INTEGER(11).ZEROFILL.UNSIGNED, {
        default: 'INTEGER(11) UNSIGNED ZEROFILL',
        postgres: 'INTEGER'
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.INTEGER();

          expect(() => {
            type.validate('foobar');
          }).to.throw(Sequelize.ValidationError, '"foobar" is not a valid integer');

          expect(() => {
            type.validate('123.45');
          }).to.throw(Sequelize.ValidationError, '"123.45" is not a valid integer');

          expect(() => {
            type.validate(123.45);
          }).to.throw(Sequelize.ValidationError, '123.45 is not a valid integer');
        });

        it('should return `true` if `value` is a valid integer', () => {
          const type = DataTypes.INTEGER();

          expect(type.validate('12345')).to.equal(true);
          expect(type.validate(12345)).to.equal(true);
        });
      });
    });

    describe('TINYINT', () => {
      const cases = [
        {
          title: 'TINYINT',
          dataType: DataTypes.TINYINT,
          expect: {
            default: 'TINYINT'
          }
        },
        {
          title: 'TINYINT(2)',
          dataType: DataTypes.TINYINT(2),
          expect: {
            default: 'TINYINT(2)'
          }
        },
        {
          title: 'TINYINT({ length: 2 })',
          dataType: DataTypes.TINYINT({ length: 2 }),
          expect: {
            default: 'TINYINT(2)'
          }
        },
        {
          title: 'TINYINT.UNSIGNED',
          dataType: DataTypes.TINYINT.UNSIGNED,
          expect: {
            default: 'TINYINT UNSIGNED'
          }
        },
        {
          title: 'TINYINT(2).UNSIGNED',
          dataType: DataTypes.TINYINT(2).UNSIGNED,
          expect: {
            default: 'TINYINT(2) UNSIGNED'
          }
        },
        {
          title: 'TINYINT.UNSIGNED.ZEROFILL',
          dataType: DataTypes.TINYINT.UNSIGNED.ZEROFILL,
          expect: {
            default: 'TINYINT UNSIGNED ZEROFILL'
          }
        },
        {
          title: 'TINYINT(2).UNSIGNED.ZEROFILL',
          dataType: DataTypes.TINYINT(2).UNSIGNED.ZEROFILL,
          expect: {
            default: 'TINYINT(2) UNSIGNED ZEROFILL'
          }
        },
        {
          title: 'TINYINT.ZEROFILL',
          dataType: DataTypes.TINYINT.ZEROFILL,
          expect: {
            default: 'TINYINT ZEROFILL'
          }
        },
        {
          title: 'TINYINT(2).ZEROFILL',
          dataType: DataTypes.TINYINT(2).ZEROFILL,
          expect: {
            default: 'TINYINT(2) ZEROFILL'
          }
        },
        {
          title: 'TINYINT.ZEROFILL.UNSIGNED',
          dataType: DataTypes.TINYINT.ZEROFILL.UNSIGNED,
          expect: {
            default: 'TINYINT UNSIGNED ZEROFILL'
          }
        },
        {
          title: 'TINYINT(2).ZEROFILL.UNSIGNED',
          dataType: DataTypes.TINYINT(2).ZEROFILL.UNSIGNED,
          expect: {
            default: 'TINYINT(2) UNSIGNED ZEROFILL'
          }
        }
      ];
      cases.forEach((row) => {
        testsql(row.title, row.dataType, row.expect);
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.TINYINT();

          expect(() => {
            type.validate('foobar');
          }).to.throw(Sequelize.ValidationError, '"foobar" is not a valid tinyint');

          expect(() => {
            type.validate(123.45);
          }).to.throw(Sequelize.ValidationError, '123.45 is not a valid tinyint');
        });

        it('should return `true` if `value` is an integer', () => {
          const type = DataTypes.TINYINT();

          expect(type.validate(-128)).to.equal(true);
          expect(type.validate('127')).to.equal(true);
        });
      });
    });

    describe('SMALLINT', () => {
      const cases = [
        {
          title: 'SMALLINT',
          dataType: DataTypes.SMALLINT,
          expect: {
            default: 'SMALLINT'
          }
        },
        {
          title: 'SMALLINT(4)',
          dataType: DataTypes.SMALLINT(4),
          expect: {
            default: 'SMALLINT(4)',
            postgres: 'SMALLINT'
          }
        },
        {
          title: 'SMALLINT({ length: 4 })',
          dataType: DataTypes.SMALLINT({ length: 4 }),
          expect: {
            default: 'SMALLINT(4)',
            postgres: 'SMALLINT'
          }
        },
        {
          title: 'SMALLINT.UNSIGNED',
          dataType: DataTypes.SMALLINT.UNSIGNED,
          expect: {
            default: 'SMALLINT UNSIGNED',
            postgres: 'SMALLINT'
          }
        },
        {
          title: 'SMALLINT(4).UNSIGNED',
          dataType: DataTypes.SMALLINT(4).UNSIGNED,
          expect: {
            default: 'SMALLINT(4) UNSIGNED',
            postgres: 'SMALLINT'
          }
        },
        {
          title: 'SMALLINT.UNSIGNED.ZEROFILL',
          dataType: DataTypes.SMALLINT.UNSIGNED.ZEROFILL,
          expect: {
            default: 'SMALLINT UNSIGNED ZEROFILL',
            postgres: 'SMALLINT'
          }
        },
        {
          title: 'SMALLINT(4).UNSIGNED.ZEROFILL',
          dataType: DataTypes.SMALLINT(4).UNSIGNED.ZEROFILL,
          expect: {
            default: 'SMALLINT(4) UNSIGNED ZEROFILL',
            postgres: 'SMALLINT'
          }
        },
        {
          title: 'SMALLINT.ZEROFILL',
          dataType: DataTypes.SMALLINT.ZEROFILL,
          expect: {
            default: 'SMALLINT ZEROFILL',
            postgres: 'SMALLINT'
          }
        },
        {
          title: 'SMALLINT(4).ZEROFILL',
          dataType: DataTypes.SMALLINT(4).ZEROFILL,
          expect: {
            default: 'SMALLINT(4) ZEROFILL',
            postgres: 'SMALLINT'
          }
        },
        {
          title: 'SMALLINT.ZEROFILL.UNSIGNED',
          dataType: DataTypes.SMALLINT.ZEROFILL.UNSIGNED,
          expect: {
            default: 'SMALLINT UNSIGNED ZEROFILL',
            postgres: 'SMALLINT'
          }
        },
        {
          title: 'SMALLINT(4).ZEROFILL.UNSIGNED',
          dataType: DataTypes.SMALLINT(4).ZEROFILL.UNSIGNED,
          expect: {
            default: 'SMALLINT(4) UNSIGNED ZEROFILL',
            postgres: 'SMALLINT'
          }
        }
      ];
      cases.forEach((row) => {
        testsql(row.title, row.dataType, row.expect);
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.SMALLINT();

          expect(() => {
            type.validate('foobar');
          }).to.throw(Sequelize.ValidationError, '"foobar" is not a valid smallint');

          expect(() => {
            type.validate(123.45);
          }).to.throw(Sequelize.ValidationError, '123.45 is not a valid smallint');
        });

        it('should return `true` if `value` is an integer', () => {
          const type = DataTypes.SMALLINT();

          expect(type.validate(-32768)).to.equal(true);
          expect(type.validate('32767')).to.equal(true);
        });
      });
    });

    describe('MEDIUMINT', () => {
      const cases = [
        {
          title: 'MEDIUMINT',
          dataType: DataTypes.MEDIUMINT,
          expect: {
            default: 'MEDIUMINT'
          }
        },
        {
          title: 'MEDIUMINT(6)',
          dataType: DataTypes.MEDIUMINT(6),
          expect: {
            default: 'MEDIUMINT(6)'
          }
        },
        {
          title: 'MEDIUMINT({ length: 6 })',
          dataType: DataTypes.MEDIUMINT({ length: 6 }),
          expect: {
            default: 'MEDIUMINT(6)'
          }
        },
        {
          title: 'MEDIUMINT.UNSIGNED',
          dataType: DataTypes.MEDIUMINT.UNSIGNED,
          expect: {
            default: 'MEDIUMINT UNSIGNED'
          }
        },
        {
          title: 'MEDIUMINT(6).UNSIGNED',
          dataType: DataTypes.MEDIUMINT(6).UNSIGNED,
          expect: {
            default: 'MEDIUMINT(6) UNSIGNED'
          }
        },
        {
          title: 'MEDIUMINT.UNSIGNED.ZEROFILL',
          dataType: DataTypes.MEDIUMINT.UNSIGNED.ZEROFILL,
          expect: {
            default: 'MEDIUMINT UNSIGNED ZEROFILL'
          }
        },
        {
          title: 'MEDIUMINT(6).UNSIGNED.ZEROFILL',
          dataType: DataTypes.MEDIUMINT(6).UNSIGNED.ZEROFILL,
          expect: {
            default: 'MEDIUMINT(6) UNSIGNED ZEROFILL'
          }
        },
        {
          title: 'MEDIUMINT.ZEROFILL',
          dataType: DataTypes.MEDIUMINT.ZEROFILL,
          expect: {
            default: 'MEDIUMINT ZEROFILL'
          }
        },
        {
          title: 'MEDIUMINT(6).ZEROFILL',
          dataType: DataTypes.MEDIUMINT(6).ZEROFILL,
          expect: {
            default: 'MEDIUMINT(6) ZEROFILL'
          }
        },
        {
          title: 'MEDIUMINT.ZEROFILL.UNSIGNED',
          dataType: DataTypes.MEDIUMINT.ZEROFILL.UNSIGNED,
          expect: {
            default: 'MEDIUMINT UNSIGNED ZEROFILL'
          }
        },
        {
          title: 'MEDIUMINT(6).ZEROFILL.UNSIGNED',
          dataType: DataTypes.MEDIUMINT(6).ZEROFILL.UNSIGNED,
          expect: {
            default: 'MEDIUMINT(6) UNSIGNED ZEROFILL'
          }
        }
      ];
      cases.forEach((row) => {
        testsql(row.title, row.dataType, row.expect);
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.MEDIUMINT();

          expect(() => {
            type.validate('foobar');
          }).to.throw(Sequelize.ValidationError, '"foobar" is not a valid mediumint');

          expect(() => {
            type.validate(123.45);
          }).to.throw(Sequelize.ValidationError, '123.45 is not a valid mediumint');
        });

        it('should return `true` if `value` is an integer', () => {
          const type = DataTypes.MEDIUMINT();

          expect(type.validate(-8388608)).to.equal(true);
          expect(type.validate('8388607')).to.equal(true);
        });
      });
    });

    describe('BIGINT', () => {
      testsql('BIGINT', DataTypes.BIGINT, {
        default: 'BIGINT'
      });

      testsql('BIGINT.UNSIGNED', DataTypes.BIGINT.UNSIGNED, {
        default: 'BIGINT UNSIGNED',
        postgres: 'BIGINT'
      });

      testsql('BIGINT.UNSIGNED.ZEROFILL', DataTypes.BIGINT.UNSIGNED.ZEROFILL, {
        default: 'BIGINT UNSIGNED ZEROFILL',
        postgres: 'BIGINT'
      });

      testsql('BIGINT(11)', DataTypes.BIGINT(11), {
        default: 'BIGINT(11)',
        postgres: 'BIGINT'
      });

      testsql('BIGINT({ length: 11 })', DataTypes.BIGINT({ length: 11 }), {
        default: 'BIGINT(11)',
        postgres: 'BIGINT'
      });

      testsql('BIGINT(11).UNSIGNED', DataTypes.BIGINT(11).UNSIGNED, {
        default: 'BIGINT(11) UNSIGNED',
        postgres: 'BIGINT'
      });

      testsql('BIGINT(11).UNSIGNED.ZEROFILL', DataTypes.BIGINT(11).UNSIGNED.ZEROFILL, {
        default: 'BIGINT(11) UNSIGNED ZEROFILL',
        postgres: 'BIGINT'
      });

      testsql('BIGINT(11).ZEROFILL', DataTypes.BIGINT(11).ZEROFILL, {
        default: 'BIGINT(11) ZEROFILL',
        postgres: 'BIGINT'
      });

      testsql('BIGINT(11).ZEROFILL.UNSIGNED', DataTypes.BIGINT(11).ZEROFILL.UNSIGNED, {
        default: 'BIGINT(11) UNSIGNED ZEROFILL',
        postgres: 'BIGINT'
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.BIGINT();

          expect(() => {
            type.validate('foobar');
          }).to.throw(Sequelize.ValidationError, '"foobar" is not a valid bigint');

          expect(() => {
            type.validate(123.45);
          }).to.throw(Sequelize.ValidationError, '123.45 is not a valid bigint');
        });

        it('should return `true` if `value` is an integer', () => {
          const type = DataTypes.BIGINT();

          expect(type.validate('9223372036854775807')).to.equal(true);
        });
      });
    });

    describe('REAL', () => {
      testsql('REAL', DataTypes.REAL, {
        default: 'REAL'
      });

      testsql('REAL.UNSIGNED', DataTypes.REAL.UNSIGNED, {
        default: 'REAL UNSIGNED',
        postgres: 'REAL'
      });

      testsql('REAL(11)', DataTypes.REAL(11), {
        default: 'REAL(11)',
        postgres: 'REAL'
      });

      testsql('REAL({ length: 11 })', DataTypes.REAL({ length: 11 }), {
        default: 'REAL(11)',
        postgres: 'REAL'
      });

      testsql('REAL(11).UNSIGNED', DataTypes.REAL(11).UNSIGNED, {
        default: 'REAL(11) UNSIGNED',
        postgres: 'REAL'
      });

      testsql('REAL(11).UNSIGNED.ZEROFILL', DataTypes.REAL(11).UNSIGNED.ZEROFILL, {
        default: 'REAL(11) UNSIGNED ZEROFILL',
        postgres: 'REAL'
      });

      testsql('REAL(11).ZEROFILL', DataTypes.REAL(11).ZEROFILL, {
        default: 'REAL(11) ZEROFILL',
        postgres: 'REAL'
      });

      testsql('REAL(11).ZEROFILL.UNSIGNED', DataTypes.REAL(11).ZEROFILL.UNSIGNED, {
        default: 'REAL(11) UNSIGNED ZEROFILL',
        postgres: 'REAL'
      });

      testsql('REAL(11, 12)', DataTypes.REAL(11, 12), {
        default: 'REAL(11,12)',
        postgres: 'REAL'
      });

      testsql('REAL(11, 12).UNSIGNED', DataTypes.REAL(11, 12).UNSIGNED, {
        default: 'REAL(11,12) UNSIGNED',
        postgres: 'REAL'
      });

      testsql('REAL({ length: 11, decimals: 12 }).UNSIGNED', DataTypes.REAL({ length: 11, decimals: 12 }).UNSIGNED, {
        default: 'REAL(11,12) UNSIGNED',
        postgres: 'REAL'
      });

      testsql('REAL(11, 12).UNSIGNED.ZEROFILL', DataTypes.REAL(11, 12).UNSIGNED.ZEROFILL, {
        default: 'REAL(11,12) UNSIGNED ZEROFILL',
        postgres: 'REAL'
      });

      testsql('REAL(11, 12).ZEROFILL', DataTypes.REAL(11, 12).ZEROFILL, {
        default: 'REAL(11,12) ZEROFILL',
        postgres: 'REAL'
      });

      testsql('REAL(11, 12).ZEROFILL.UNSIGNED', DataTypes.REAL(11, 12).ZEROFILL.UNSIGNED, {
        default: 'REAL(11,12) UNSIGNED ZEROFILL',
        postgres: 'REAL'
      });
    });

    describe('DOUBLE PRECISION', () => {
      testsql('DOUBLE', DataTypes.DOUBLE, {
        default: 'DOUBLE PRECISION'
      });

      testsql('DOUBLE.UNSIGNED', DataTypes.DOUBLE.UNSIGNED, {
        default: 'DOUBLE PRECISION UNSIGNED',
        postgres: 'DOUBLE PRECISION'
      });

      testsql('DOUBLE(11)', DataTypes.DOUBLE(11), {
        default: 'DOUBLE PRECISION(11)',
        postgres: 'DOUBLE PRECISION'
      });

      testsql('DOUBLE(11).UNSIGNED', DataTypes.DOUBLE(11).UNSIGNED, {
        default: 'DOUBLE PRECISION(11) UNSIGNED',
        postgres: 'DOUBLE PRECISION'
      });

      testsql('DOUBLE({ length: 11 }).UNSIGNED', DataTypes.DOUBLE({ length: 11 }).UNSIGNED, {
        default: 'DOUBLE PRECISION(11) UNSIGNED',
        postgres: 'DOUBLE PRECISION'
      });

      testsql('DOUBLE(11).UNSIGNED.ZEROFILL', DataTypes.DOUBLE(11).UNSIGNED.ZEROFILL, {
        default: 'DOUBLE PRECISION(11) UNSIGNED ZEROFILL',
        postgres: 'DOUBLE PRECISION'
      });

      testsql('DOUBLE(11).ZEROFILL', DataTypes.DOUBLE(11).ZEROFILL, {
        default: 'DOUBLE PRECISION(11) ZEROFILL',
        postgres: 'DOUBLE PRECISION'
      });

      testsql('DOUBLE(11).ZEROFILL.UNSIGNED', DataTypes.DOUBLE(11).ZEROFILL.UNSIGNED, {
        default: 'DOUBLE PRECISION(11) UNSIGNED ZEROFILL',
        postgres: 'DOUBLE PRECISION'
      });

      testsql('DOUBLE(11, 12)', DataTypes.DOUBLE(11, 12), {
        default: 'DOUBLE PRECISION(11,12)',
        postgres: 'DOUBLE PRECISION'
      });

      testsql('DOUBLE(11, 12).UNSIGNED', DataTypes.DOUBLE(11, 12).UNSIGNED, {
        default: 'DOUBLE PRECISION(11,12) UNSIGNED',
        postgres: 'DOUBLE PRECISION'
      });

      testsql('DOUBLE(11, 12).UNSIGNED.ZEROFILL', DataTypes.DOUBLE(11, 12).UNSIGNED.ZEROFILL, {
        default: 'DOUBLE PRECISION(11,12) UNSIGNED ZEROFILL',
        postgres: 'DOUBLE PRECISION'
      });

      testsql('DOUBLE(11, 12).ZEROFILL', DataTypes.DOUBLE(11, 12).ZEROFILL, {
        default: 'DOUBLE PRECISION(11,12) ZEROFILL',
        postgres: 'DOUBLE PRECISION'
      });

      testsql('DOUBLE(11, 12).ZEROFILL.UNSIGNED', DataTypes.DOUBLE(11, 12).ZEROFILL.UNSIGNED, {
        default: 'DOUBLE PRECISION(11,12) UNSIGNED ZEROFILL',
        postgres: 'DOUBLE PRECISION'
      });
    });

    describe('FLOAT', () => {
      testsql('FLOAT', DataTypes.FLOAT, {
        default: 'FLOAT',
        postgres: 'FLOAT'
      });

      testsql('FLOAT.UNSIGNED', DataTypes.FLOAT.UNSIGNED, {
        default: 'FLOAT UNSIGNED',
        postgres: 'FLOAT'
      });

      testsql('FLOAT(11)', DataTypes.FLOAT(11), {
        default: 'FLOAT(11)',
        postgres: 'FLOAT(11)' // 1-24 = 4 bytes; 35-53 = 8 bytes
      });

      testsql('FLOAT(11).UNSIGNED', DataTypes.FLOAT(11).UNSIGNED, {
        default: 'FLOAT(11) UNSIGNED',
        postgres: 'FLOAT(11)'
      });

      testsql('FLOAT(11).UNSIGNED.ZEROFILL', DataTypes.FLOAT(11).UNSIGNED.ZEROFILL, {
        default: 'FLOAT(11) UNSIGNED ZEROFILL',
        postgres: 'FLOAT(11)'
      });

      testsql('FLOAT(11).ZEROFILL', DataTypes.FLOAT(11).ZEROFILL, {
        default: 'FLOAT(11) ZEROFILL',
        postgres: 'FLOAT(11)'
      });

      testsql('FLOAT({ length: 11 }).ZEROFILL', DataTypes.FLOAT({ length: 11 }).ZEROFILL, {
        default: 'FLOAT(11) ZEROFILL',
        postgres: 'FLOAT(11)'
      });

      testsql('FLOAT(11).ZEROFILL.UNSIGNED', DataTypes.FLOAT(11).ZEROFILL.UNSIGNED, {
        default: 'FLOAT(11) UNSIGNED ZEROFILL',
        postgres: 'FLOAT(11)'
      });

      testsql('FLOAT(11, 12)', DataTypes.FLOAT(11, 12), {
        default: 'FLOAT(11,12)',
        postgres: 'FLOAT'
      });

      testsql('FLOAT(11, 12).UNSIGNED', DataTypes.FLOAT(11, 12).UNSIGNED, {
        default: 'FLOAT(11,12) UNSIGNED',
        postgres: 'FLOAT'
      });

      testsql('FLOAT({ length: 11, decimals: 12 }).UNSIGNED', DataTypes.FLOAT({ length: 11, decimals: 12 }).UNSIGNED, {
        default: 'FLOAT(11,12) UNSIGNED',
        postgres: 'FLOAT'
      });

      testsql('FLOAT(11, 12).UNSIGNED.ZEROFILL', DataTypes.FLOAT(11, 12).UNSIGNED.ZEROFILL, {
        default: 'FLOAT(11,12) UNSIGNED ZEROFILL',
        postgres: 'FLOAT'
      });

      testsql('FLOAT(11, 12).ZEROFILL', DataTypes.FLOAT(11, 12).ZEROFILL, {
        default: 'FLOAT(11,12) ZEROFILL',
        postgres: 'FLOAT'
      });

      testsql('FLOAT(11, 12).ZEROFILL.UNSIGNED', DataTypes.FLOAT(11, 12).ZEROFILL.UNSIGNED, {
        default: 'FLOAT(11,12) UNSIGNED ZEROFILL',
        postgres: 'FLOAT'
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.FLOAT();

          expect(() => {
            type.validate('foobar');
          }).to.throw(Sequelize.ValidationError, '"foobar" is not a valid float');
        });

        it('should return `true` if `value` is a float', () => {
          const type = DataTypes.FLOAT();

          expect(type.validate(1.2)).to.equal(true);
          expect(type.validate('1')).to.equal(true);
          expect(type.validate('1.2')).to.equal(true);
          expect(type.validate('-0.123')).to.equal(true);
          expect(type.validate('-0.22250738585072011e-307')).to.equal(true);
        });
      });
    });

    if (current.dialect.supports.NUMERIC) {
      testsql('NUMERIC', DataTypes.NUMERIC, {
        default: 'DECIMAL'
      });

      testsql('NUMERIC(15,5)', DataTypes.NUMERIC(15, 5), {
        default: 'DECIMAL(15,5)'
      });
    }

    describe('DECIMAL', () => {
      testsql('DECIMAL', DataTypes.DECIMAL, {
        default: 'DECIMAL'
      });

      testsql('DECIMAL(10, 2)', DataTypes.DECIMAL(10, 2), {
        default: 'DECIMAL(10,2)'
      });

      testsql('DECIMAL({ precision: 10, scale: 2 })', DataTypes.DECIMAL({ precision: 10, scale: 2 }), {
        default: 'DECIMAL(10,2)'
      });

      testsql('DECIMAL(10)', DataTypes.DECIMAL(10), {
        default: 'DECIMAL(10)'
      });

      testsql('DECIMAL({ precision: 10 })', DataTypes.DECIMAL({ precision: 10 }), {
        default: 'DECIMAL(10)'
      });

      testsql('DECIMAL.UNSIGNED', DataTypes.DECIMAL.UNSIGNED, {
        default: 'DECIMAL'
      });

      testsql('DECIMAL.UNSIGNED.ZEROFILL', DataTypes.DECIMAL.UNSIGNED.ZEROFILL, {
        default: 'DECIMAL'
      });

      testsql(
        'DECIMAL({ precision: 10, scale: 2 }).UNSIGNED',
        DataTypes.DECIMAL({ precision: 10, scale: 2 }).UNSIGNED,
        {
          default: 'DECIMAL(10,2)'
        }
      );

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.DECIMAL(10);

          expect(() => {
            type.validate('foobar');
          }).to.throw(Sequelize.ValidationError, '"foobar" is not a valid decimal');

          expect(() => {
            type.validate('0.1a');
          }).to.throw(Sequelize.ValidationError, '"0.1a" is not a valid decimal');

          expect(() => {
            type.validate(NaN);
          }).to.throw(Sequelize.ValidationError, 'null is not a valid decimal');
        });

        it('should return `true` if `value` is a decimal', () => {
          const type = DataTypes.DECIMAL(10);

          expect(type.validate(123)).to.equal(true);
          expect(type.validate(1.2)).to.equal(true);
          expect(type.validate(-0.25)).to.equal(true);
          expect(type.validate(0.0000000000001)).to.equal(true);
          expect(type.validate('123')).to.equal(true);
          expect(type.validate('1.2')).to.equal(true);
          expect(type.validate('-0.25')).to.equal(true);
          expect(type.validate('0.0000000000001')).to.equal(true);
        });
      });
    });

    describe('ENUM', () => {
      // TODO: Fix Enums and add more tests
      // testsql('ENUM("value 1", "value 2")', DataTypes.ENUM('value 1', 'value 2'), {
      //   default: 'ENUM'
      // });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.ENUM('foo');

          expect(() => {
            type.validate('foobar');
          }).to.throw(Sequelize.ValidationError, '"foobar" is not a valid choice in ["foo"]');
        });

        it('should return `true` if `value` is a valid choice', () => {
          const type = DataTypes.ENUM('foobar', 'foobiz');

          expect(type.validate('foobar')).to.equal(true);
          expect(type.validate('foobiz')).to.equal(true);
        });
      });
    });

    describe('BLOB', () => {
      testsql('BLOB', DataTypes.BLOB, {
        default: 'BLOB',
        postgres: 'BYTEA'
      });

      testsql('BLOB("tiny")', DataTypes.BLOB('tiny'), {
        default: 'TINYBLOB',
        postgres: 'BYTEA'
      });

      testsql('BLOB("medium")', DataTypes.BLOB('medium'), {
        default: 'MEDIUMBLOB',
        postgres: 'BYTEA'
      });

      testsql('BLOB({ length: "medium" })', DataTypes.BLOB({ length: 'medium' }), {
        default: 'MEDIUMBLOB',
        postgres: 'BYTEA'
      });

      testsql('BLOB("long")', DataTypes.BLOB('long'), {
        default: 'LONGBLOB',
        postgres: 'BYTEA'
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.BLOB();

          expect(() => {
            type.validate(12345);
          }).to.throw(Sequelize.ValidationError, '12345 is not a valid blob');
        });

        it('should return `true` if `value` is a blob', () => {
          const type = DataTypes.BLOB();

          expect(type.validate('foobar')).to.equal(true);
          expect(type.validate(new Buffer('foobar'))).to.equal(true);
        });
      });
    });

    describe('RANGE', () => {
      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.RANGE();

          expect(() => {
            type.validate('foobar');
          }).to.throw(Sequelize.ValidationError, '"foobar" is not a valid range');
        });

        it('should throw an error if `value` is not an array with two elements', () => {
          const type = DataTypes.RANGE();

          expect(() => {
            type.validate([1]);
          }).to.throw(Sequelize.ValidationError, 'A range must be an array with two elements');
        });

        it('should throw an error if `value.inclusive` is invalid', () => {
          const type = DataTypes.RANGE();

          expect(() => {
            type.validate({ inclusive: 'foobar' });
          }).to.throw(Sequelize.ValidationError, '"foobar" is not a valid range');
        });

        it('should throw an error if `value.inclusive` is not an array with two elements', () => {
          const type = DataTypes.RANGE();

          expect(() => {
            type.validate({ inclusive: [1] });
          }).to.throw(Sequelize.ValidationError, 'A range must be an array with two elements');
        });

        it('should return `true` if `value` is a range', () => {
          const type = DataTypes.RANGE();

          expect(type.validate([1, 2])).to.equal(true);
        });

        it('should return `true` if `value.inclusive` is a range', () => {
          const type = DataTypes.RANGE();

          expect(type.validate({ inclusive: [1, 2] })).to.equal(true);
        });
      });
    });

    if (current.dialect.supports.ARRAY) {
      describe('ARRAY', () => {
        testsql('ARRAY(VARCHAR)', DataTypes.ARRAY(DataTypes.STRING), {
          postgres: 'VARCHAR(255)[]'
        });

        testsql('ARRAY(VARCHAR(100))', DataTypes.ARRAY(DataTypes.STRING(100)), {
          postgres: 'VARCHAR(100)[]'
        });

        testsql('ARRAY(INTEGER)', DataTypes.ARRAY(DataTypes.INTEGER), {
          postgres: 'INTEGER[]'
        });

        testsql('ARRAY(HSTORE)', DataTypes.ARRAY(DataTypes.HSTORE), {
          postgres: 'HSTORE[]'
        });

        testsql('ARRAY(ARRAY(VARCHAR(255)))', DataTypes.ARRAY(DataTypes.ARRAY(DataTypes.STRING)), {
          postgres: 'VARCHAR(255)[][]'
        });

        testsql('ARRAY(TEXT)', DataTypes.ARRAY(DataTypes.TEXT), {
          postgres: 'TEXT[]'
        });

        testsql('ARRAY(DATE)', DataTypes.ARRAY(DataTypes.DATE), {
          postgres: 'TIMESTAMP WITH TIME ZONE[]'
        });

        testsql('ARRAY(BOOLEAN)', DataTypes.ARRAY(DataTypes.BOOLEAN), {
          postgres: 'BOOLEAN[]'
        });

        testsql('ARRAY(DECIMAL)', DataTypes.ARRAY(DataTypes.DECIMAL), {
          postgres: 'DECIMAL[]'
        });

        testsql('ARRAY(DECIMAL(6))', DataTypes.ARRAY(DataTypes.DECIMAL(6)), {
          postgres: 'DECIMAL(6)[]'
        });

        testsql('ARRAY(DECIMAL(6,4))', DataTypes.ARRAY(DataTypes.DECIMAL(6, 4)), {
          postgres: 'DECIMAL(6,4)[]'
        });

        testsql('ARRAY(DOUBLE)', DataTypes.ARRAY(DataTypes.DOUBLE), {
          postgres: 'DOUBLE PRECISION[]'
        });

        testsql('ARRAY(REAL))', DataTypes.ARRAY(DataTypes.REAL), {
          postgres: 'REAL[]'
        });

        if (current.dialect.supports.JSON) {
          testsql('ARRAY(JSON)', DataTypes.ARRAY(DataTypes.JSON), {
            postgres: 'JSON[]'
          });
        }

        if (current.dialect.supports.JSONB) {
          testsql('ARRAY(JSONB)', DataTypes.ARRAY(DataTypes.JSONB), {
            postgres: 'JSONB[]'
          });
        }

        describe('validate', () => {
          it('should throw an error if `value` is invalid', () => {
            const type = DataTypes.ARRAY();

            expect(() => {
              type.validate('foobar');
            }).to.throw(Sequelize.ValidationError, '"foobar" is not a valid array');
          });

          it('should return `true` if `value` is an array', () => {
            const type = DataTypes.ARRAY();

            expect(type.validate(['foo', 'bar'])).to.equal(true);
          });
        });
      });
    }

    if (current.dialect.supports.GEOMETRY) {
      describe('GEOMETRY', () => {
        testsql('GEOMETRY', DataTypes.GEOMETRY, {
          default: 'GEOMETRY'
        });

        testsql("GEOMETRY('POINT')", DataTypes.GEOMETRY('POINT'), {
          postgres: 'GEOMETRY(POINT)'
        });

        testsql("GEOMETRY('LINESTRING')", DataTypes.GEOMETRY('LINESTRING'), {
          postgres: 'GEOMETRY(LINESTRING)'
        });

        testsql("GEOMETRY('POLYGON')", DataTypes.GEOMETRY('POLYGON'), {
          postgres: 'GEOMETRY(POLYGON)'
        });

        testsql("GEOMETRY('POINT',4326)", DataTypes.GEOMETRY('POINT', 4326), {
          postgres: 'GEOMETRY(POINT,4326)'
        });
      });
    }
  });
});
