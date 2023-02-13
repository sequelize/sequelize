import { expect } from 'chai';
import { cast, col, DataTypes, fn, Op, Where, Json } from '@sequelize/core';
import type { AbstractQueryGenerator } from '@sequelize/core';
import { canTreatArrayAsAnd } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { toDefaultValue } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/dialect.js';
import { mapFinderOptions, mapOptionFieldNames } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/format.js';
import { defaults, merge, cloneDeep, flattenObjectDeep } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { underscoredIf, camelizeIf, pluralize, singularize } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import { parseConnectionString } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/url.js';
import { sequelize, getTestDialect, expectsql } from '../../support';

const dialect = sequelize.dialect;

describe('Utils', () => {
  describe('underscore', () => {
    describe('underscoredIf', () => {
      it('is defined', () => {
        expect(underscoredIf).to.be.ok;
      });

      it('underscores if second param is true', () => {
        expect(underscoredIf('fooBar', true)).to.equal('foo_bar');
      });

      it('doesn\'t underscore if second param is false', () => {
        expect(underscoredIf('fooBar', false)).to.equal('fooBar');
      });
    });

    describe('camelizeIf', () => {
      it('is defined', () => {
        expect(camelizeIf).to.be.ok;
      });

      it('camelizes if second param is true', () => {
        expect(camelizeIf('foo_bar', true)).to.equal('fooBar');
      });

      it('doesn\'t camelize if second param is false', () => {
        expect(underscoredIf('fooBar', true)).to.equal('foo_bar');
      });
    });
  });

  describe('cloneDeep', () => {
    it('should clone objects', () => {
      const obj = { foo: 1 };
      const clone = cloneDeep(obj);

      expect(obj).to.not.equal(clone);
    });

    it('should clone nested objects', () => {
      const obj = { foo: { bar: 1 } };
      const clone = cloneDeep(obj);

      expect(obj.foo).to.not.equal(clone.foo);
    });

    it('should not call clone methods on plain objects', () => {
      expect(() => {
        cloneDeep({
          clone() {
            throw new Error('clone method called');
          },
        });
      }).to.not.throw();
    });

    it('should not call clone methods on arrays', () => {
      expect(() => {
        const arr: unknown[] = [];

        // @ts-expect-error -- type error normal, you're not supposed to add methods to array instances.
        arr.clone = function clone() {
          throw new Error('clone method called');
        };

        cloneDeep(arr);
      }).to.not.throw();
    });
  });

  if (getTestDialect() === 'postgres') {
    describe('json', () => {
      let queryGenerator: AbstractQueryGenerator;
      beforeEach(() => {
        queryGenerator = sequelize.getQueryInterface().queryGenerator;
      });

      it('successfully parses a complex nested condition hash', () => {
        const conditions = {
          metadata: {
            language: 'icelandic',
            pg_rating: { dk: 'G' },
          },
          another_json_field: { x: 1 },
        };
        const expected = '("metadata"#>>\'{language}\') = \'icelandic\' AND ("metadata"#>>\'{pg_rating,dk}\') = \'G\' AND ("another_json_field"#>>\'{x}\') = \'1\'';
        expect(queryGenerator.handleSequelizeMethod(new Json(conditions))).to.deep.equal(expected);
      });

      it('successfully parses a string using dot notation', () => {
        const path = 'metadata.pg_rating.dk';
        expect(queryGenerator.handleSequelizeMethod(new Json(path))).to.equal('("metadata"#>>\'{pg_rating,dk}\')');
      });

      it('allows postgres json syntax', () => {
        const path = 'metadata->pg_rating->>dk';
        expect(queryGenerator.handleSequelizeMethod(new Json(path))).to.equal(path);
      });

      it('can take a value to compare against', () => {
        const path = 'metadata.pg_rating.is';
        const value = 'U';
        expect(queryGenerator.handleSequelizeMethod(new Json(path, value))).to.equal('("metadata"#>>\'{pg_rating,is}\') = \'U\'');
      });
    });
  }

  describe('inflection', () => {
    it('should pluralize/singularize words correctly', () => {
      expect(pluralize('buy')).to.equal('buys');
      expect(pluralize('holiday')).to.equal('holidays');
      expect(pluralize('days')).to.equal('days');
      expect(pluralize('status')).to.equal('statuses');

      expect(singularize('status')).to.equal('status');
    });
  });

  describe('flattenObjectDeep', () => {
    it('should return the value if it is not an object', () => {
      const value = 'non-object';
      const returnedValue = flattenObjectDeep(value);
      expect(returnedValue).to.equal(value);
    });

    it('should return correctly if values are null', () => {
      const value = {
        name: 'John',
        address: {
          street: 'Fake St. 123',
          city: null,
          coordinates: {
            longitude: 55.677_962_7,
            latitude: 12.596_431_3,
          },
        },
      };
      const returnedValue = flattenObjectDeep(value);
      expect(returnedValue).to.deep.equal({
        name: 'John',
        'address.street': 'Fake St. 123',
        'address.city': null,
        'address.coordinates.longitude': 55.677_962_7,
        'address.coordinates.latitude': 12.596_431_3,
      });
    });
  });

  describe('url', () => {
    it('should return the correct options after parsed', () => {
      const options = parseConnectionString('pg://wpx%20ss:wpx%20ss@21.77.77:4001/database ss');
      expect(options.dialect).to.equal('pg');
      expect(options.host).to.equal('21.77.77');
      expect(options.port).to.equal('4001');
      expect(options.database).to.equal('database ss');
      expect(options.username).to.equal('wpx ss');
      expect(options.password).to.equal('wpx ss');
    });
  });

  describe('merge', () => {
    it('does not clone sequelize models', () => {
      const User = sequelize.define('user');
      const merged = merge({}, { include: [{ model: User }] });
      const merged2 = merge({}, { user: User });

      // @ts-expect-error -- TODO: merge's return type is bad, to improve
      expect(merged.include[0].model).to.equal(User);
      // @ts-expect-error -- see above
      expect(merged2.user).to.equal(User);
    });
  });

  describe('canTreatArrayAsAnd', () => {
    it('Array can be treated as and', () => {
      expect(canTreatArrayAsAnd([{ uuid: 1 }])).to.equal(true);
      expect(canTreatArrayAsAnd([{ uuid: 1 }, { uuid: 2 }, 1])).to.equal(true);
      expect(canTreatArrayAsAnd([new Where(col('uuid'), 1)])).to.equal(true);
      expect(canTreatArrayAsAnd([new Where(col('uuid'), 1), new Where(col('uuid'), 2)])).to.equal(true);
      expect(canTreatArrayAsAnd([new Where(col('uuid'), 1), { uuid: 2 }, 1])).to.equal(true);
    });
    it('Array cannot be treated as and', () => {
      expect(canTreatArrayAsAnd([1, 'uuid'])).to.equal(false);
      expect(canTreatArrayAsAnd([1])).to.equal(false);
    });
  });

  describe('toDefaultValue', () => {
    it('return plain data types', () => {
      expect(() => toDefaultValue(DataTypes.UUIDV4, dialect)).to.throw();
    });
    it('return uuid v1', () => {
      expect(/^[\da-z-]{36}$/.test(toDefaultValue(DataTypes.UUIDV1(), dialect) as string)).to.be.equal(true);
    });
    it('return uuid v4', () => {
      expect(/^[\da-z-]{36}/.test(toDefaultValue(DataTypes.UUIDV4(), dialect) as string)).to.be.equal(true);
    });
    it('return now', () => {
      expect(Object.prototype.toString.call(toDefaultValue(DataTypes.NOW(), dialect))).to.be.equal('[object Date]');
    });
    it('return plain string', () => {
      expect(toDefaultValue('Test', dialect)).to.equal('Test');
    });
    it('return plain object', () => {
      expect(toDefaultValue({}, dialect)).to.deep.equal({});
    });
  });

  describe('defaults', () => {
    it('defaults normal object', () => {
      expect(defaults(
        { a: 1, c: 3 },
        { b: 2 },
        { c: 4, d: 4 },
      )).to.eql({
        a: 1,
        b: 2,
        c: 3,
        d: 4,
      });
    });

    it('defaults symbol keys', () => {
      expect(defaults(
        { a: 1, [Symbol.for('eq')]: 3 },
        { b: 2 },
        { [Symbol.for('eq')]: 4, [Symbol.for('ne')]: 4 },
      )).to.eql({
        a: 1,
        b: 2,
        [Symbol.for('eq')]: 3,
        [Symbol.for('ne')]: 4,
      });
    });
  });

  describe('mapFinderOptions', () => {
    it('virtual attribute dependencies', () => {
      const User = sequelize.define('User', {
        createdAt: {
          type: DataTypes.DATE,
          field: 'created_at',
        },
        active: {
          type: new DataTypes.VIRTUAL(DataTypes.BOOLEAN, ['createdAt']),
        },
      });

      expect(
        mapFinderOptions({ attributes: ['active'] }, User).attributes,
      ).to.eql([
        [
          'created_at',
          'createdAt',
        ],
      ]);
    });

    it('multiple calls', () => {
      const User = sequelize.define('User', {
        createdAt: {
          type: DataTypes.DATE,
          field: 'created_at',
        },
        active: {
          type: new DataTypes.VIRTUAL(DataTypes.BOOLEAN, ['createdAt']),
        },
      });

      expect(
        mapFinderOptions(
          // @ts-expect-error -- TODO: improve mapFinderOptions typing
          mapFinderOptions({
            attributes: [
              'active',
            ],
          }, User),
          User,
        ).attributes,
      ).to.eql([
        ['created_at', 'createdAt'],
      ]);
    });
  });

  describe('mapOptionFieldNames', () => {
    it('plain where', () => {
      expect(mapOptionFieldNames({
        where: {
          firstName: 'Paul',
          lastName: 'Atreides',
        },
      }, sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          field: 'first_name',
        },
        lastName: {
          type: DataTypes.STRING,
          field: 'last_name',
        },
      }))).to.eql({
        where: {
          first_name: 'Paul',
          last_name: 'Atreides',
        },
      });
    });

    it('Op.or where', () => {
      expect(mapOptionFieldNames({
        where: {
          [Op.or]: {
            firstName: 'Paul',
            lastName: 'Atreides',
          },
        },
      }, sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          field: 'first_name',
        },
        lastName: {
          type: DataTypes.STRING,
          field: 'last_name',
        },
      }))).to.eql({
        where: {
          [Op.or]: {
            first_name: 'Paul',
            last_name: 'Atreides',
          },
        },
      });
    });

    it('Op.or[] where', () => {
      expect(mapOptionFieldNames({
        where: {
          [Op.or]: [
            { firstName: 'Paul' },
            { lastName: 'Atreides' },
          ],
        },
      }, sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          field: 'first_name',
        },
        lastName: {
          type: DataTypes.STRING,
          field: 'last_name',
        },
      }))).to.eql({
        where: {
          [Op.or]: [
            { first_name: 'Paul' },
            { last_name: 'Atreides' },
          ],
        },
      });
    });

    it('$and where', () => {
      expect(mapOptionFieldNames({
        where: {
          [Op.and]: {
            firstName: 'Paul',
            lastName: 'Atreides',
          },
        },
      }, sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          field: 'first_name',
        },
        lastName: {
          type: DataTypes.STRING,
          field: 'last_name',
        },
      }))).to.eql({
        where: {
          [Op.and]: {
            first_name: 'Paul',
            last_name: 'Atreides',
          },
        },
      });
    });
  });

  describe('Sequelize.cast', () => {
    const generator = sequelize.queryInterface.queryGenerator;

    it('accepts condition object (auto casting)', () => {
      expectsql(() => generator.handleSequelizeMethod(fn('SUM', cast({
        [Op.or]: {
          foo: 'foo',
          bar: 'bar',
        },
      }, 'int'))), {
        default: `SUM(CAST(([foo] = 'foo' OR [bar] = 'bar') AS INT))`,
        mssql: `SUM(CAST(([foo] = N'foo' OR [bar] = N'bar') AS INT))`,
      });
    });
  });
});
