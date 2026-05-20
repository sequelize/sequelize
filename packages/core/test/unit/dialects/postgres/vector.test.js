'use strict';

const Support = require('../../../support');
const { DataTypes, Op, sql } = require('@sequelize/core');
const { expect } = require('chai');

const expectsql = Support.expectsql;
const current = Support.sequelize;
const queryGenerator = current.dialect.queryGenerator;

if (current.dialect.name === 'postgres') {
  describe('[Postgres Specific] VECTOR', () => {
    describe('VECTOR datatype', () => {
      it('renders pgvector SQL without format', () => {
        const type = DataTypes.VECTOR(3, 'float32').toDialectDataType(current.dialect);

        expect(type.toSql()).to.equal('VECTOR(3)');
      });

      it('escapes array values as pgvector literals', () => {
        expectsql(queryGenerator.escape([1, 2, 3], { type: DataTypes.VECTOR(3) }), {
          postgres: `'[1,2,3]'::vector`,
        });
      });

      it('escapes typed array values as pgvector literals', () => {
        expectsql(
          queryGenerator.escape(new Float32Array([1, 2, 3]), { type: DataTypes.VECTOR(3) }),
          {
            postgres: `'[1,2,3]'::vector`,
          },
        );
      });

      it('validates fixed dimensions', () => {
        const type = DataTypes.VECTOR(3).toDialectDataType(current.dialect);

        expect(() => type.validate([1, 2, 3])).not.to.throw();
        expect(() => type.validate([1, 2])).to.throw(
          Error,
          'VECTOR expects values of length 3, but received 2',
        );
      });

      it('does not validate elements when validating dimensions', () => {
        const type = DataTypes.VECTOR(3).toDialectDataType(current.dialect);

        expect(() => type.validate([1, Infinity, 3])).not.to.throw();
      });

      it('rejects non-finite values when serializing values', () => {
        expect(() =>
          queryGenerator.escape([1, Infinity, 3], { type: DataTypes.VECTOR(3) }),
        ).to.throw(Error, 'is not a valid vector');
      });

      it('rejects dimensions above pgvector max size', () => {
        const type = DataTypes.VECTOR(16_001).toDialectDataType(current.dialect);

        expect(() => type.toSql()).to.throw(
          TypeError,
          'Invalid VECTOR dimension: 16001 (max 16000)',
        );
      });

      it('parses pgvector values from the database', () => {
        const type = DataTypes.VECTOR(3).toDialectDataType(current.dialect);

        expect(type.parseDatabaseValue('[1,2,3]')).to.deep.equal([1, 2, 3]);
      });
    });

    describe('VECTOR functions', () => {
      it('renders l2 distance using pgvector operator', () => {
        const where = sql.where(current.l2Distance('embedding', [1, 2, 3]), {
          [Op.lt]: 1.5,
        });

        expectsql(queryGenerator.whereItemsQuery(where), {
          postgres: `("embedding" <-> '[1,2,3]'::vector) < 1.5`,
        });
      });

      it('renders cosine distance using pgvector operator', () => {
        const where = sql.where(current.cosineDistance('embedding', [1, 2, 3]), {
          [Op.lt]: 0.5,
        });

        expectsql(queryGenerator.whereItemsQuery(where), {
          postgres: `("embedding" <=> '[1,2,3]'::vector) < 0.5`,
        });
      });

      it('renders inner product using pgvector operator', () => {
        const where = sql.where(current.innerProduct('embedding', [1, 2, 3]), {
          [Op.gt]: 0,
        });

        expectsql(queryGenerator.whereItemsQuery(where), {
          postgres: `(("embedding" <#> '[1,2,3]'::vector) * -1) > 0`,
        });
      });

      it('renders l1 distance using pgvector operator', () => {
        const where = sql.where(current.l1Distance('embedding', [1, 2, 3]), {
          [Op.lt]: 10,
        });

        expectsql(queryGenerator.whereItemsQuery(where), {
          postgres: `("embedding" <+> '[1,2,3]'::vector) < 10`,
        });
      });

      it('maps vectorDistance to l2 distance operator', () => {
        const where = sql.where(current.vectorDistance('embedding', [1, 2, 3]), {
          [Op.lt]: 1.5,
        });

        expectsql(queryGenerator.whereItemsQuery(where), {
          postgres: `("embedding" <-> '[1,2,3]'::vector) < 1.5`,
        });
      });

      it('supports typed arrays', () => {
        const where = sql.where(current.innerProduct('embedding', new Float32Array([1, 2, 3])), {
          [Op.gt]: 0,
        });

        expectsql(queryGenerator.whereItemsQuery(where), {
          postgres: `(("embedding" <#> '[1,2,3]'::vector) * -1) > 0`,
        });
      });

      it('accepts pgvector literal strings', () => {
        const where = sql.where(current.l2Distance('embedding', `'[1,2,3]'::vector`), {
          [Op.lt]: 2,
        });

        expectsql(queryGenerator.whereItemsQuery(where), {
          postgres: `("embedding" <-> '[1,2,3]'::vector) < 2`,
        });
      });

      it('rejects unsafe pgvector literal strings', () => {
        for (const payload of [
          "'[1,2,3]'); DROP TABLE users; --'::vector",
          "'[1,2,3]'::vector; DROP TABLE users; --",
          '[1,2,3]; DROP TABLE users; --',
        ]) {
          expect(() =>
            queryGenerator.formatSqlExpression(current.l2Distance('embedding', payload)),
          ).to.throw(
            Error,
            'L2_DISTANCE expects the second argument to be a number array, typed array, or pgvector literal string',
          );
        }
      });

      it('accepts JSON array strings by normalizing to pgvector literals', () => {
        const where = sql.where(current.l2Distance('embedding', '[1,2,3]'), {
          [Op.lt]: 2,
        });

        expectsql(queryGenerator.whereItemsQuery(where), {
          postgres: `("embedding" <-> '[1,2,3]'::vector) < 2`,
        });
      });

      it('throws for malformed vector literal strings', () => {
        expect(() =>
          queryGenerator.formatSqlExpression(current.l2Distance('embedding', 'not-a-vector')),
        ).to.throw(
          Error,
          'L2_DISTANCE expects the second argument to be a number array, typed array, or pgvector literal string',
        );
      });

      it('throws when vector function has too few arguments', () => {
        expect(() =>
          queryGenerator.formatSqlExpression(sql.fn('L2_DISTANCE', sql.attribute('embedding'))),
        ).to.throw(Error, 'L2_DISTANCE expects exactly 2 arguments');
      });

      it('throws when vector function has too many arguments', () => {
        expect(() =>
          queryGenerator.formatSqlExpression(
            sql.fn('L2_DISTANCE', sql.attribute('embedding'), [1, 2, 3], [4, 5, 6]),
          ),
        ).to.throw(Error, 'L2_DISTANCE expects exactly 2 arguments');
      });

      it('throws for empty vector arrays', () => {
        expect(() =>
          queryGenerator.formatSqlExpression(current.l2Distance('embedding', [])),
        ).to.throw(Error, 'Vector arguments must contain at least one element');
      });

      it('throws for invalid vector array elements', () => {
        expect(() =>
          queryGenerator.formatSqlExpression(current.l2Distance('embedding', [1, '2', 3])),
        ).to.throw(Error, 'is not a valid vector element');
      });

      it('rejects DataView inputs as vector arguments', () => {
        expect(() =>
          queryGenerator.formatSqlExpression(
            current.l2Distance('embedding', new DataView(new ArrayBuffer(8))),
          ),
        ).to.throw(
          Error,
          'L2_DISTANCE expects the second argument to be a number array, typed array, or pgvector literal string',
        );
      });
    });
  });
}
