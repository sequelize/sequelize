import { DataTypes, Sequelize, ValidationErrorItem } from '@sequelize/core';
import * as BaseTypes from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import { OracleDialect } from '@sequelize/oracle';
import { expect } from 'chai';
import { VECTOR } from './data-types-overrides';

describe('Oracle VECTOR data type', () => {
  const dialect = new Sequelize({ dialect: OracleDialect }).dialect;

  function toOracleVector(type: BaseTypes.VECTOR): VECTOR {
    return type.toDialectDataType(dialect) as VECTOR;
  }

  it('extends the core VECTOR type', () => {
    const type = new VECTOR(3);

    expect(type).to.be.instanceOf(VECTOR);
    expect(type).to.be.instanceOf(BaseTypes.VECTOR);
  });

  it('renders the default float32 element type explicitly', () => {
    expect(toOracleVector(DataTypes.VECTOR()).toSql()).to.equal('VECTOR(*, FLOAT32)');
    expect(toOracleVector(DataTypes.VECTOR(3)).toSql()).to.equal('VECTOR(3, FLOAT32)');
  });

  it('renders each Oracle-supported element type', () => {
    expect(
      toOracleVector(DataTypes.VECTOR({ dimensions: 3, elementType: 'float64' })).toSql(),
    ).to.equal('VECTOR(3, FLOAT64)');
    expect(
      toOracleVector(DataTypes.VECTOR({ dimensions: 3, elementType: 'int8' })).toSql(),
    ).to.equal('VECTOR(3, INT8)');
    expect(
      toOracleVector(DataTypes.VECTOR({ dimensions: 24, elementType: 'binary' })).toSql(),
    ).to.equal('VECTOR(24, BINARY)');
  });

  it('rejects element types unsupported by Oracle', () => {
    expect(() =>
      toOracleVector(DataTypes.VECTOR({ dimensions: 3, elementType: 'float16' })),
    ).to.throw('oracle does not support the VECTOR(float16) data type');
  });

  it('converts plain arrays to the matching Oracle driver typed array', () => {
    expect(toOracleVector(DataTypes.VECTOR(3)).toBindableValue([1, 2, 3])).to.be.instanceOf(
      Float32Array,
    );
    expect(
      toOracleVector(DataTypes.VECTOR({ dimensions: 3, elementType: 'float64' })).toBindableValue([
        1, 2, 3,
      ]),
    ).to.be.instanceOf(Float64Array);
    expect(
      toOracleVector(DataTypes.VECTOR({ dimensions: 3, elementType: 'int8' })).toBindableValue([
        1, 2, 3,
      ]),
    ).to.be.instanceOf(Int8Array);
  });

  it('keeps matching typed arrays unchanged', () => {
    const value = new Float32Array([1, 2, 3]);

    expect(toOracleVector(DataTypes.VECTOR(3)).toBindableValue(value)).to.equal(value);
  });

  it('rejects non-finite results of FLOAT32 conversion before collecting a bind value', () => {
    const type = toOracleVector(DataTypes.VECTOR(1));
    let bound = false;

    expect(() =>
      type.getBindParamSql([Number.MAX_VALUE], {
        bindParam: () => {
          bound = true;

          return '$value';
        },
      }),
    ).to.throw(ValidationErrorItem, 'VECTOR value overflows FLOAT32');
    expect(bound).to.equal(false);
  });

  it('accepts finite FLOAT32 boundaries and normal rounding without changing the input', () => {
    const maximum = 3.402_823_466_385_288_6e38;
    const value = [maximum, -maximum, 0.1];
    const converted = toOracleVector(DataTypes.VECTOR(3)).toBindableValue(value);

    expect(converted).to.deep.equal(new Float32Array([maximum, -maximum, Math.fround(0.1)]));
    expect(value).to.deep.equal([maximum, -maximum, 0.1]);
  });

  it('uses core element validation', () => {
    const type = toOracleVector(DataTypes.VECTOR(3));

    expect(() => type.validate([1, Number.NaN, 3])).to.throw('not a valid vector element');
  });

  it('returns Oracle VECTOR bind metadata', () => {
    const type = toOracleVector(DataTypes.VECTOR(3));

    expect(type._getBindDef({ DB_TYPE_VECTOR: 'DB_TYPE_VECTOR' } as never)).to.deep.equal({
      type: 'DB_TYPE_VECTOR',
    });
  });
});
