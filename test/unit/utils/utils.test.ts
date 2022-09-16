'use strict';

import { Utils } from '@sequelize/core';
import chai from 'chai';
import type { AbstractQueryGenerator } from '../../../types/dialects/abstract/query-generator.js';
import { getTestDialectTeaser, sequelize, getTestDialect } from '../../support';

const expect = chai.expect;

describe(getTestDialectTeaser('Utils'), () => {
  describe('underscore', () => {
    describe('underscoredIf', () => {
      it('is defined', () => {
        expect(Utils.underscoredIf).to.be.ok;
      });

      it('underscores if second param is true', () => {
        expect(Utils.underscoredIf('fooBar', true)).to.equal('foo_bar');
      });

      it('doesn\'t underscore if second param is false', () => {
        expect(Utils.underscoredIf('fooBar', false)).to.equal('fooBar');
      });
    });

    describe('camelizeIf', () => {
      it('is defined', () => {
        expect(Utils.camelizeIf).to.be.ok;
      });

      it('camelizes if second param is true', () => {
        expect(Utils.camelizeIf('foo_bar', true)).to.equal('fooBar');
      });

      it('doesn\'t camelize if second param is false', () => {
        expect(Utils.underscoredIf('fooBar', true)).to.equal('foo_bar');
      });
    });
  });

  describe('cloneDeep', () => {
    it('should clone objects', () => {
      const obj = { foo: 1 };
      const clone = Utils.cloneDeep(obj);

      expect(obj).to.not.equal(clone);
    });

    it('should clone nested objects', () => {
      const obj = { foo: { bar: 1 } };
      const clone = Utils.cloneDeep(obj);

      expect(obj.foo).to.not.equal(clone.foo);
    });

    it('should not call clone methods on plain objects', () => {
      expect(() => {
        Utils.cloneDeep({
          clone() {
            throw new Error('clone method called');
          },
        });
      }).to.not.throw();
    });

    it('should not call clone methods on arrays', () => {
      expect(() => {
        const arr: unknown[] = [];

        // @ts-expect-error
        arr.clone = function clone() {
          throw new Error('clone method called');
        };

        Utils.cloneDeep(arr);
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
        expect(queryGenerator.handleSequelizeMethod(new Utils.Json(conditions))).to.deep.equal(expected);
      });

      it('successfully parses a string using dot notation', () => {
        const path = 'metadata.pg_rating.dk';
        expect(queryGenerator.handleSequelizeMethod(new Utils.Json(path))).to.equal('("metadata"#>>\'{pg_rating,dk}\')');
      });

      it('allows postgres json syntax', () => {
        const path = 'metadata->pg_rating->>dk';
        expect(queryGenerator.handleSequelizeMethod(new Utils.Json(path))).to.equal(path);
      });

      it('can take a value to compare against', () => {
        const path = 'metadata.pg_rating.is';
        const value = 'U';
        expect(queryGenerator.handleSequelizeMethod(new Utils.Json(path, value))).to.equal('("metadata"#>>\'{pg_rating,is}\') = \'U\'');
      });
    });
  }

  describe('inflection', () => {
    it('should pluralize/singularize words correctly', () => {
      expect(Utils.pluralize('buy')).to.equal('buys');
      expect(Utils.pluralize('holiday')).to.equal('holidays');
      expect(Utils.pluralize('days')).to.equal('days');
      expect(Utils.pluralize('status')).to.equal('statuses');

      expect(Utils.singularize('status')).to.equal('status');
    });
  });

  describe('flattenObjectDeep', () => {
    it('should return the value if it is not an object', () => {
      const value = 'non-object';
      const returnedValue = Utils.flattenObjectDeep(value);
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
      const returnedValue = Utils.flattenObjectDeep(value);
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
      const options = Utils.parseConnectionString('pg://wpx%20ss:wpx%20ss@21.77.77:4001/database ss');
      expect(options.dialect).to.equal('pg');
      expect(options.host).to.equal('21.77.77');
      expect(options.port).to.equal('4001');
      expect(options.database).to.equal('database ss');
      expect(options.username).to.equal('wpx ss');
      expect(options.password).to.equal('wpx ss');
    });
  });
});
