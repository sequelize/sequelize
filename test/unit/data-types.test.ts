import { DataTypes } from '@sequelize/core';
import type { StringifyOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/data-types.js';
import { expect } from 'chai';
import identity from 'lodash/identity';
import { sequelize } from '../support';

const dialect = sequelize.dialect;

const stringifyOptions: StringifyOptions = {
  dialect,
  escape: identity,
};

describe('DataTypes', () => {
  const now = new Date();
  const nowString = now.toISOString();
  const dateType = DataTypes.DATE().toDialectDataType(dialect);
  const dateOnlyType = DataTypes.DATEONLY().toDialectDataType(dialect);

  describe('DATE/DATEONLY Validate and Stringify', () => {
    it('DATE should validate a Date as normal', () => {
      expect(() => dateType.validate(now)).not.to.throw();
      expect(() => dateType.validate(nowString)).not.to.throw();
    });

    if (dialect.name === 'postgres') {
      it('DATE should validate Infinity/-Infinity as true', () => {
        expect(() => dateType.validate(Number.POSITIVE_INFINITY)).not.to.throw();
        expect(() => dateType.validate(Number.NEGATIVE_INFINITY)).not.to.throw();
      });

      it('DATE should stringify Infinity/-Infinity to infinity/-infinity', () => {
        expect(dateType.toBindableValue(Number.POSITIVE_INFINITY, stringifyOptions)).to.equal('infinity');
        expect(dateType.toBindableValue(Number.NEGATIVE_INFINITY, stringifyOptions)).to.equal('-infinity');
      });

      it('DATEONLY should stringify Infinity/-Infinity to infinity/-infinity', () => {
        expect(dateOnlyType.toBindableValue(Number.POSITIVE_INFINITY, stringifyOptions)).to.equal('infinity');
        expect(dateOnlyType.toBindableValue(Number.NEGATIVE_INFINITY, stringifyOptions)).to.equal('-infinity');
      });
    }
  });

  describe('DATE/DATEONLY Sanitize', () => {
    const nowDateOnly = nowString.slice(0, 10);

    it('DATE should sanitize a Date as normal', () => {
      expect(dateType.sanitize(now)).to.equalTime(now);
      expect(dateType.sanitize(nowString)).to.equalTime(now);
    });

    if (dialect.supports.dataTypes.DATETIME.infinity) {
      it('DATE should sanitize numeric Infinity/-Infinity as Infinity/-Infinity', () => {
        expect(dateType.sanitize(Number.POSITIVE_INFINITY)).to.equal(Number.POSITIVE_INFINITY);
        expect(dateType.sanitize(Number.NEGATIVE_INFINITY)).to.equal(Number.NEGATIVE_INFINITY);
      });

      it('DATE should sanitize "Infinity"/"-Infinity" as Infinity/-Infinity', () => {
        expect(dateType.sanitize('Infinity')).to.equal(Number.POSITIVE_INFINITY);
        expect(dateType.sanitize('-Infinity')).to.equal(Number.NEGATIVE_INFINITY);
      });
    }

    it('DATEONLY should sanitize a Date as normal', () => {
      expect(dateOnlyType.sanitize(now)).to.equal(nowDateOnly);
      expect(dateOnlyType.sanitize(nowString)).to.equal(nowDateOnly);
    });

    if (dialect.supports.dataTypes.DATEONLY.infinity) {
      it('DATEONLY should sanitize numeric Infinity/-Infinity as Infinity/-Infinity', () => {
        expect(dateOnlyType.sanitize(Number.POSITIVE_INFINITY)).to.equal(Number.POSITIVE_INFINITY);
        expect(dateOnlyType.sanitize(Number.NEGATIVE_INFINITY)).to.equal(Number.NEGATIVE_INFINITY);
      });

      it('DATEONLY should sanitize "Infinity"/"-Infinity" as Infinity/-Infinity', () => {
        expect(dateOnlyType.sanitize('Infinity')).to.equal(Number.POSITIVE_INFINITY);
        expect(dateOnlyType.sanitize('-Infinity')).to.equal(Number.NEGATIVE_INFINITY);
      });
    }
  });
});
