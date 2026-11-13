import type { DataTypeInstance, VectorElementType, VectorValue } from '@sequelize/core';
import { DataTypes, ValidationErrorItem, sql } from '@sequelize/core';
import * as BaseTypes from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import { expect } from 'chai';
import { expectsql, sequelize } from '../../support';
import { testDataTypeSql } from './_utils';

const dialect = sequelize.dialect;
const dialectName = dialect.name;
const vectorElementTypes = [
  'float16',
  'float32',
  'float64',
  'int8',
  'binary',
] as const satisfies readonly VectorElementType[];

describe('DataTypes.VECTOR', () => {
  describe('constructor', () => {
    it('defaults to float32 and plain-array reads', () => {
      const type = DataTypes.VECTOR();

      expect(type.options).to.deep.equal({ elementType: 'float32', typedArray: false });
    });

    it('supports positional dimensions', () => {
      const type = DataTypes.VECTOR(4);

      expect(type.options).to.deep.equal({
        dimensions: 4,
        elementType: 'float32',
        typedArray: false,
      });
    });

    it('supports the options object', () => {
      const type = DataTypes.VECTOR({
        dimensions: 8,
        elementType: 'float64',
        typedArray: true,
      });

      expect(type.options).to.deep.equal({
        dimensions: 8,
        elementType: 'float64',
        typedArray: true,
      });
    });

    it('rejects a positional element type', () => {
      const Vector = DataTypes.VECTOR as unknown as (
        dimensions: number,
        elementType: string,
      ) => unknown;

      expect(() => Vector(3, 'float64')).to.throw(
        TypeError,
        'Pass elementType in the options object instead',
      );
    });

    it('rejects invalid dimensions', () => {
      expect(() => DataTypes.VECTOR(0)).to.throw(TypeError, 'Invalid VECTOR dimensions');
      expect(() => DataTypes.VECTOR({ dimensions: 1.5 })).to.throw(
        TypeError,
        'Invalid VECTOR dimensions',
      );
    });

    it('rejects unsupported element types', () => {
      expect(() => DataTypes.VECTOR({ dimensions: 3, elementType: 'int32' as 'float32' })).to.throw(
        TypeError,
        'Invalid VECTOR element type',
      );
    });

    it('rejects unknown options instead of silently dropping them', () => {
      expect(() => DataTypes.VECTOR({ dimensions: 3, storage: 'dense' } as never)).to.throw(
        TypeError,
        'Unknown VECTOR option(s): storage',
      );
    });

    it('requires a boolean typedArray option', () => {
      expect(() => DataTypes.VECTOR({ typedArray: 'yes' } as never)).to.throw(
        TypeError,
        'VECTOR typedArray must be a boolean',
      );
    });

    it('requires binary dimensions to be a multiple of 8', () => {
      expect(() => DataTypes.VECTOR({ dimensions: 9, elementType: 'binary' })).to.throw(
        TypeError,
        'VECTOR dimensions must be a multiple of 8',
      );
    });
  });

  describe('dialect capabilities', () => {
    const support = dialect.supports.dataTypes.VECTOR;

    it('accepts exactly the element types declared by the dialect', () => {
      for (const elementType of vectorElementTypes) {
        const dimensions = elementType === 'binary' ? 8 : 1;
        const normalize = () =>
          sequelize.normalizeDataType(DataTypes.VECTOR({ dimensions, elementType }));

        if (support && support.elementTypes[elementType]) {
          expect(normalize, elementType).not.to.throw();
        } else {
          expect(normalize, elementType).to.throw(
            `${dialectName} does not support the VECTOR${support ? `(${elementType})` : ''} data type`,
          );
        }
      }
    });

    it('dialect VECTOR implementations are instances of DataTypes.VECTOR', () => {
      if (!support) {
        return;
      }

      const dialectVector = sequelize.normalizeDataType(DataTypes.VECTOR(1));

      expect(dialectVector).to.be.instanceOf(DataTypes.VECTOR);
    });

    it('enforces the maximum dimensions declared for each element type', () => {
      if (!support) {
        return;
      }

      for (const elementType of vectorElementTypes) {
        const elementTypeSupport = support.elementTypes[elementType];
        if (!elementTypeSupport) {
          continue;
        }

        const { maxDimensions } = elementTypeSupport;
        const firstInvalidDimensions = maxDimensions + (elementType === 'binary' ? 8 : 1);

        expect(() =>
          sequelize.normalizeDataType(DataTypes.VECTOR({ dimensions: maxDimensions, elementType })),
        ).not.to.throw();
        expect(() =>
          sequelize.normalizeDataType(
            DataTypes.VECTOR({ dimensions: firstInvalidDimensions, elementType }),
          ),
        ).to.throw(
          `${dialectName} supports at most ${maxDimensions} dimensions for VECTOR element type ${elementType}`,
        );
      }
    });

    it('allows omitted dimensions only when declared by the dialect', () => {
      const normalize = () => sequelize.normalizeDataType(DataTypes.VECTOR());

      if (!support) {
        expect(normalize).to.throw(`${dialectName} does not support the VECTOR data type`);
      } else if (support.optionalDimensions) {
        expect(normalize).not.to.throw();
      } else {
        expect(normalize).to.throw(`${dialectName} requires VECTOR dimensions to be specified`);
      }
    });
  });

  describe('toSql', () => {
    it('requires dialect-specific SQL rendering', () => {
      expect(() => DataTypes.VECTOR(3).toSql()).to.throw(
        'VECTOR SQL rendering must be implemented by the dialect.',
      );
    });

    testDataTypeSql('VECTOR', DataTypes.VECTOR, {
      default: new Error(`${dialectName} does not support the VECTOR data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`),
      oracle: 'VECTOR(*, FLOAT32)',
    });

    testDataTypeSql('VECTOR(4)', DataTypes.VECTOR(4), {
      default: new Error(`${dialectName} does not support the VECTOR data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`),
      oracle: 'VECTOR(4, FLOAT32)',
    });

    testDataTypeSql(
      "VECTOR({ dimensions: 3, elementType: 'float64' })",
      DataTypes.VECTOR({ dimensions: 3, elementType: 'float64' }),
      {
        default: new Error(`${dialectName} does not support the VECTOR data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`),
        oracle: 'VECTOR(3, FLOAT64)',
      },
    );

    testDataTypeSql(
      "VECTOR({ dimensions: 24, elementType: 'binary' })",
      DataTypes.VECTOR({ dimensions: 24, elementType: 'binary' }),
      {
        default: new Error(`${dialectName} does not support the VECTOR data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`),
        oracle: 'VECTOR(24, BINARY)',
      },
    );

    testDataTypeSql(
      "VECTOR({ dimensions: 3, elementType: 'float16' })",
      DataTypes.VECTOR({ dimensions: 3, elementType: 'float16' }),
      {
        default: new Error(`${dialectName} does not support the VECTOR data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`),
        oracle: new Error(`oracle does not support the VECTOR(float16) data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`),
      },
    );

    testDataTypeSql('VECTOR(65536)', DataTypes.VECTOR(65_536), {
      default: new Error(`${dialectName} does not support the VECTOR data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`),
      oracle: new Error('oracle supports at most 65535 dimensions for VECTOR element type float32'),
    });

    it('renders VECTOR casts for the selected dialect', () => {
      expectsql(
        () =>
          sequelize.queryGenerator.escape(
            sql.cast(sql.attribute('embedding'), DataTypes.VECTOR(3)),
          ),
        {
          default: new Error(`${dialectName} does not support the VECTOR data type`),
          oracle: 'CAST("embedding" AS VECTOR(3, FLOAT32))',
        },
      );
    });
  });

  describe('validate', () => {
    it('should throw an error if value is invalid', () => {
      const type: DataTypeInstance = DataTypes.VECTOR();

      expect(() => {
        type.validate('vector');
      }).to.throw(ValidationErrorItem, "'vector' is not a valid vector");
    });

    it('accepts a non-empty finite number array with matching dimensions', () => {
      const type = DataTypes.VECTOR(3);

      expect(() => type.validate([1, 2, 3])).not.to.throw();
    });

    it('rejects empty, non-finite and wrong-length values', () => {
      const type = DataTypes.VECTOR(3);

      expect(() => type.validate([])).to.throw(ValidationErrorItem, 'must not be empty');
      expect(() => type.validate([1, Number.NaN, 3])).to.throw(
        ValidationErrorItem,
        'not a valid vector element',
      );
      expect(() => type.validate([1, 2])).to.throw(ValidationErrorItem, 'but 3 were expected');
    });

    it('rejects non-numeric elements and unsupported typed arrays', () => {
      const type = DataTypes.VECTOR(3);

      for (const value of [
        ['a', {}, 3],
        [1, Number.POSITIVE_INFINITY, 3],
        new Int16Array([1, 2, 3]),
        new Uint16Array([1, 2, 3]),
        new Int32Array([1, 2, 3]),
        new Uint32Array([1, 2, 3]),
        new Uint8ClampedArray([1, 2, 3]),
      ]) {
        expect(() => type.validate(value)).to.throw(ValidationErrorItem);
      }
    });

    it('requires typed arrays to match the element type', () => {
      expect(() => DataTypes.VECTOR(3).validate(new Float32Array([1, 2, 3]))).not.to.throw();
      expect(() =>
        DataTypes.VECTOR({ dimensions: 3, elementType: 'float64' }).validate(
          new Float32Array([1, 2, 3]),
        ),
      ).to.throw(ValidationErrorItem, 'Float32Array is not valid for VECTOR element type float64');
    });

    it('validates int8 ranges', () => {
      const type = DataTypes.VECTOR({ dimensions: 2, elementType: 'int8' });

      expect(() => type.validate([-128, 127])).not.to.throw();
      expect(() => type.validate([1, 128])).to.throw(
        ValidationErrorItem,
        '128 is not a valid int8 vector element',
      );
      expect(() => type.validate([1, 1.5])).to.throw(
        ValidationErrorItem,
        '1.5 is not a valid int8 vector element',
      );
    });

    it('requires binary values to be packed Uint8Arrays', () => {
      const type = DataTypes.VECTOR({ dimensions: 24, elementType: 'binary' });

      expect(() => type.validate(new Uint8Array([1, 2, 3]))).not.to.throw();
      expect(() => type.validate([1, 2, 3])).to.throw(
        ValidationErrorItem,
        'Array is not valid for VECTOR element type binary',
      );
    });

    it('allows dialects to delegate element validation while retaining structural validation', () => {
      class DriverValidatedVector extends BaseTypes.VECTOR {
        protected override _validateVectorElements(_value: VectorValue): void {}
      }

      const type = new DriverValidatedVector(2);

      expect(() => type.validate([1, Number.NaN])).not.to.throw();
      expect(() => type.validate([1])).to.throw(ValidationErrorItem, 'but 2 were expected');
      expect(() => type.validate('vector')).to.throw(
        ValidationErrorItem,
        "'vector' is not a valid vector",
      );
    });
  });

  describe('parseDatabaseValue', () => {
    it('returns number arrays by default', () => {
      const result = DataTypes.VECTOR(3).parseDatabaseValue(new Float32Array([1, 2, 3]));

      expect(result).to.deep.equal([1, 2, 3]);
    });

    it('returns the matching typed array when opted in', () => {
      const result = DataTypes.VECTOR({ dimensions: 3, typedArray: true }).parseDatabaseValue([
        1, 2, 3,
      ]);

      expect(result).to.be.instanceOf(Float32Array);
    });

    it('always returns packed binary vectors as Uint8Array', () => {
      const value = new Uint8Array([1, 2, 3]);
      const result = DataTypes.VECTOR({
        dimensions: 24,
        elementType: 'binary',
      }).parseDatabaseValue(value);

      expect(result).to.equal(value);
    });
  });

  describe('areValuesEqual', () => {
    it('compares vector values element-by-element across array kinds', () => {
      const type = DataTypes.VECTOR(3);

      expect(type.areValuesEqual([1, 2, 3], new Float32Array([1, 2, 3]))).to.be.true;
      expect(type.areValuesEqual([1, 2, 3], new Float32Array([1, 2, 4]))).to.be.false;
    });

    it('handles a missing original value during model construction', () => {
      const type = DataTypes.VECTOR(3);

      expect(type.areValuesEqual([1, 2, 3], undefined as never)).to.be.false;
    });
  });
});
