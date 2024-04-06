import { DataTypes, sql } from '@sequelize/core';
import { toDefaultValue } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/dialect.js';
import { mapFinderOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/format.js';
import {
  cloneDeep,
  defaults,
  flattenObjectDeep,
  merge,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import {
  pluralize,
  singularize,
  underscoredIf,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import { expect } from 'chai';
import { allowDeprecationsInSuite, sequelize } from '../../support';

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

      it("doesn't underscore if second param is false", () => {
        expect(underscoredIf('fooBar', false)).to.equal('fooBar');
      });
    });
  });

  describe('cloneDeep', () => {
    it('should clone objects', () => {
      const obj = { foo: 1 };

      const clone = cloneDeep(obj);
      expect(clone).to.deep.equal(obj);
      expect(clone).to.not.equal(obj);
    });

    it('should clone nested objects', () => {
      const obj = { foo: { bar: 1 } };

      const clone = cloneDeep(obj);
      expect(clone).to.deep.equal(obj);
      expect(clone).to.not.equal(obj);
    });

    it('clones sql expression builders', () => {
      const obj = [
        sql`literal test`,
        sql.where({ foo: 'bar' }),
        sql.col('foo'),
        sql.unquote('foo'),
        sql.cast('foo', 'bar'),
        sql.fn('foo', 'bar'),
        sql.attribute('foo'),
        sql.identifier('foo'),
        sql.jsonPath(sql.attribute('foo'), ['foo']),
        sql.list(['a', 'b']),
      ];

      const clone = cloneDeep(obj);
      expect(clone).to.deep.equal(obj);
      expect(clone).to.not.equal(obj);
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

  describe('toDefaultValue', () => {
    allowDeprecationsInSuite(['SEQUELIZE0026']);

    it('return uuid v1', () => {
      expect(
        /^[\da-z-]{36}$/.test(
          toDefaultValue(new DataTypes.UUIDV1().toDialectDataType(dialect)) as string,
        ),
      ).to.equal(true);
    });
    it('return uuid v4', () => {
      expect(
        /^[\da-z-]{36}/.test(
          toDefaultValue(new DataTypes.UUIDV4().toDialectDataType(dialect)) as string,
        ),
      ).to.equal(true);
    });
    it('return now', () => {
      expect(
        Object.prototype.toString.call(
          toDefaultValue(new DataTypes.NOW().toDialectDataType(dialect)),
        ),
      ).to.equal('[object Date]');
    });
    it('return plain string', () => {
      expect(toDefaultValue('Test')).to.equal('Test');
    });
    it('return plain object', () => {
      expect(toDefaultValue({})).to.deep.equal({});
    });
  });

  describe('defaults', () => {
    it('defaults normal object', () => {
      expect(defaults({ a: 1, c: 3 }, { b: 2 }, { c: 4, d: 4 })).to.eql({
        a: 1,
        b: 2,
        c: 3,
        d: 4,
      });
    });

    it('defaults symbol keys', () => {
      expect(
        defaults(
          { a: 1, [Symbol.for('eq')]: 3 },
          { b: 2 },
          { [Symbol.for('eq')]: 4, [Symbol.for('ne')]: 4 },
        ),
      ).to.eql({
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

      expect(mapFinderOptions({ attributes: ['active'] }, User).attributes).to.eql([
        ['created_at', 'createdAt'],
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
          mapFinderOptions(
            {
              attributes: ['active'],
            },
            User,
          ),
          User,
        ).attributes,
      ).to.eql([['created_at', 'createdAt']]);
    });
  });
});
