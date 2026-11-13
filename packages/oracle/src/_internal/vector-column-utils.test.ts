import { DataTypes, Sequelize } from '@sequelize/core';
import { OracleDialect } from '@sequelize/oracle';
import { expect } from 'chai';
import { getOracleColumnType, shouldSkipOracleVectorColumnChange } from './vector-column-utils';

describe('Oracle VECTOR column utilities', () => {
  describe('getOracleColumnType', () => {
    it('adds VECTOR dimensions and element type to described columns', () => {
      expect(
        getOracleColumnType({ DATA_TYPE: 'VECTOR', VECTOR_INFO: 'VECTOR(768,float32)' }),
      ).to.equal('VECTOR(768, FLOAT32)');
    });

    it('normalizes Oracle dense storage metadata without treating it as a type change', () => {
      expect(
        getOracleColumnType({ DATA_TYPE: 'VECTOR', VECTOR_INFO: 'VECTOR(768,float32,DENSE)' }),
      ).to.equal('VECTOR(768, FLOAT32)');
    });

    it('preserves unrecognized VECTOR metadata instead of treating it as a dense definition', () => {
      expect(
        getOracleColumnType({ DATA_TYPE: 'VECTOR', VECTOR_INFO: 'VECTOR(768,float32,OTHER)' }),
      ).to.equal('VECTOR(768,FLOAT32,OTHER)');
    });

    it('leaves non-VECTOR column types unchanged', () => {
      expect(getOracleColumnType({ DATA_TYPE: 'varchar2' })).to.equal('VARCHAR2');
    });
  });

  describe('shouldSkipOracleVectorColumnChange', () => {
    const sequelize = new Sequelize({ dialect: OracleDialect });
    const vector = sequelize.normalizeDataType(DataTypes.VECTOR(3));
    const makeQueryInterface = (type: string) => ({
      normalizeAttribute: () => ({ type: vector, field: 'embedding_vector' }),
      describeTable: async () => ({ embedding_vector: { type } }),
    });

    it('skips an unchanged VECTOR definition', async () => {
      expect(
        await shouldSkipOracleVectorColumnChange(
          makeQueryInterface('VECTOR(3,float32)'),
          'items',
          'embedding',
          vector,
        ),
      ).to.equal(true);
    });

    it('throws a clear error for a real VECTOR definition change', async () => {
      let error: unknown;
      try {
        await shouldSkipOracleVectorColumnChange(
          makeQueryInterface('VECTOR(4, FLOAT32)'),
          'items',
          'embedding',
          vector,
        );
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.include(
        'Changing Oracle VECTOR column embedding_vector from VECTOR(4, FLOAT32) to VECTOR(3, FLOAT32) is not supported',
      );
    });

    it('does not guess when VECTOR metadata is unavailable', async () => {
      let error: unknown;
      try {
        await shouldSkipOracleVectorColumnChange(
          makeQueryInterface('VECTOR'),
          'items',
          'embedding',
          vector,
        );
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.include(
        'dimensions and element type were not returned by the database',
      );
    });

    it('reports a missing VECTOR column instead of skipping its change', async () => {
      const queryInterface = {
        normalizeAttribute: () => ({ type: vector, columnName: 'embedding_vector' }),
        describeTable: async () => ({}),
      };

      let error: unknown;
      try {
        await shouldSkipOracleVectorColumnChange(queryInterface, 'items', 'embedding', vector);
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.equal(
        'Could not find Oracle VECTOR column embedding_vector while changing its type.',
      );
    });

    it('does not handle non-VECTOR columns', async () => {
      const queryInterface = {
        normalizeAttribute: () => ({ type: DataTypes.STRING() }),
        describeTable: async () => {
          throw new Error('describeTable should not be called');
        },
      };

      expect(
        await shouldSkipOracleVectorColumnChange(queryInterface, 'items', 'name', DataTypes.STRING),
      ).to.equal(false);
    });

    it('does not handle raw or missing column types', async () => {
      const results = await Promise.all(
        [() => ({ type: 'VARCHAR2(100)' }), () => ({})].map(async normalizeAttribute => {
          const queryInterface = {
            normalizeAttribute,
            describeTable: async () => {
              throw new Error('describeTable should not be called');
            },
          };

          return shouldSkipOracleVectorColumnChange(
            queryInterface,
            'items',
            'name',
            'VARCHAR2(100)',
          );
        }),
      );

      expect(results).to.deep.equal([false, false]);
    });

    for (const allowNull of [true, false]) {
      it(`skips an unchanged VECTOR with allowNull: ${allowNull}`, async () => {
        const attribute = { type: vector, field: 'embedding_vector', allowNull };
        const queryInterface = {
          normalizeAttribute: () => attribute,
          describeTable: async () => ({
            embedding_vector: { type: 'VECTOR(3, FLOAT32)', allowNull },
          }),
        };

        expect(
          await shouldSkipOracleVectorColumnChange(queryInterface, 'items', 'embedding', attribute),
        ).to.equal(true);
      });

      it(`rejects changing VECTOR allowNull from ${allowNull} to ${!allowNull}`, async () => {
        const attribute = { type: vector, field: 'embedding_vector', allowNull: !allowNull };
        const queryInterface = {
          normalizeAttribute: () => attribute,
          describeTable: async () => ({
            embedding_vector: { type: 'VECTOR(3, FLOAT32)', allowNull },
          }),
        };

        let error: unknown;
        try {
          await shouldSkipOracleVectorColumnChange(queryInterface, 'items', 'embedding', attribute);
        } catch (caughtError) {
          error = caughtError;
        }

        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.equal(
          'Changing nullability of Oracle VECTOR column embedding_vector is not supported by sync({ alter: true }). Use an explicit migration.',
        );
      });
    }
  });
});
