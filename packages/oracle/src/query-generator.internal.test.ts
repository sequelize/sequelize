import type { IndexOptions } from '@sequelize/core';
import { DataTypes, Sequelize, ValidationErrorItem, sql } from '@sequelize/core';
import { OracleDialect } from '@sequelize/oracle';
import { expect } from 'chai';
import sinon from 'sinon';

describe('Oracle query generator internals', () => {
  const sequelize = new Sequelize({ dialect: OracleDialect });
  const queryGenerator = sequelize.queryGenerator;

  describe('Oracle VECTOR column options', () => {
    const vector = sequelize.normalizeDataType(DataTypes.VECTOR(3));
    const validate = (options: object) =>
      queryGenerator._validateAttributes({ embedding: { type: vector, ...options } });

    // Oracle VECTOR restrictions, including defaults and primary/foreign keys:
    // https://docs.oracle.com/en/database/oracle/oracle-database/26/vecse/create-tables-using-vector-data-type.html
    for (const [name, options, message] of [
      ['array default', { defaultValue: [1, 2, 3] }, 'does not support database defaults'],
      ['NULL default', { defaultValue: null }, 'does not support database defaults'],
      ['SQL default', { defaultValue: sql.literal('NULL') }, 'does not support database defaults'],
      ['primary key', { primaryKey: true }, 'cannot be used as a primary key'],
      ['unique constraint', { unique: true }, 'cannot be used in a non-vector index'],
      [
        'foreign key',
        { references: { table: 'items', key: 'id' } },
        'cannot be used as a foreign key',
      ],
      ['auto increment', { autoIncrement: true }, 'does not support autoIncrement'],
    ] as const) {
      it(`rejects a VECTOR ${name}`, () => {
        expect(() => validate(options)).to.throw(`Oracle VECTOR column embedding ${message}.`);
      });
    }

    it('allows JavaScript default functions without evaluating them', () => {
      expect(() =>
        validate({
          defaultValue: () => {
            throw new Error('Schema validation must not evaluate application defaults');
          },
        }),
      ).not.to.throw();
    });

    it('allows nullable and non-nullable ordinary VECTOR columns', () => {
      expect(() =>
        validate({ allowNull: true, primaryKey: false, autoIncrement: false }),
      ).not.to.throw();
      expect(() => validate({ allowNull: false })).not.to.throw();
    });

    it('leaves non-VECTOR attribute options to their existing validation', () => {
      expect(() =>
        queryGenerator._validateAttributes({
          id: {
            type: sequelize.normalizeDataType(DataTypes.INTEGER),
            defaultValue: 1,
            primaryKey: true,
          },
        }),
      ).not.to.throw();
    });
  });

  for (const [name, attributeOptions, indexes] of [
    ['attribute uniqueness', { unique: true }, []],
    ['named attribute uniqueness', { unique: 'embedding_unique' }, []],
    ['attribute index', { index: true }, []],
    ['model unique index', {}, [{ unique: true, fields: ['embedding_vector'] }]],
    ['model ordinary index', {}, [{ fields: [{ name: 'embedding_vector' }] }]],
    ['model composite index', {}, [{ fields: ['id', 'embedding_vector'] }]],
  ] satisfies Array<[string, object, IndexOptions[]]>) {
    for (const syncOptions of [{}, { alter: true }, { force: true, hooks: false }]) {
      it(`rejects VECTOR ${name} before sync executes SQL with ${JSON.stringify(syncOptions)}`, async () => {
        const Item = sequelize.define(
          'IndexedVectorItem',
          {
            embedding: {
              type: DataTypes.VECTOR(3),
              columnName: 'embedding_vector',
              ...attributeOptions,
            },
          },
          { indexes: structuredClone(indexes) },
        );
        const query = sinon.stub(sequelize, 'queryRaw');

        try {
          // unique/index have already moved out of the physical attribute into resolved indexes.
          const error = await Item.sync(syncOptions).catch((caughtError: unknown) => caughtError);
          expect(error).to.be.instanceOf(Error);
          expect((error as Error).message).to.equal(
            'Oracle VECTOR column embedding_vector cannot be used in a non-vector index.',
          );
          expect(query.called).to.equal(false);
        } finally {
          query.restore();
        }
      });
    }
  }

  for (const fields of [['embedding_vector'], [{ name: 'embedding_vector' }]]) {
    it(`rejects direct VECTOR indexes on ${JSON.stringify(fields)} before index SQL`, async () => {
      const description = sinon.stub(sequelize.queryInterface, 'describeTable').resolves({
        embedding_vector: { type: 'VECTOR(3, FLOAT32)' },
      } as never);
      const query = sinon.stub(sequelize, 'queryRaw');

      try {
        const error = await sequelize.queryInterface
          .addIndex('items', { fields })
          .catch((caughtError: unknown) => caughtError);
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.equal(
          'Oracle VECTOR column embedding_vector cannot be used in a non-vector index.',
        );
        expect(query.called).to.equal(false);
      } finally {
        description.restore();
        query.restore();
      }
    });
  }

  it('validates VECTOR options for model preflight and direct column SQL', () => {
    const attribute = {
      type: sequelize.normalizeDataType(DataTypes.VECTOR(3)),
      columnName: 'embedding_vector',
      defaultValue: [1, 2, 3],
    };

    expect(() => queryGenerator._validateAttributes({ embedding: attribute })).to.throw(
      'Oracle VECTOR column embedding_vector does not support database defaults.',
    );
    expect(() => queryGenerator.attributeToSql(attribute)).to.throw(
      'Oracle VECTOR column embedding_vector does not support database defaults.',
    );
  });

  for (const [option, options, message] of [
    ['database defaults', { defaultValue: [1, 2, 3] }, 'does not support database defaults'],
    ['uniqueness', { unique: true }, 'cannot be used in a non-vector index'],
  ] as const) {
    const attribute = { type: DataTypes.VECTOR(3), ...options };
    for (const [name, operation] of Object.entries({
      createTable: async () =>
        sequelize.queryInterface.createTable('items', { embedding: attribute }),
      addColumn: async () => sequelize.queryInterface.addColumn('items', 'embedding', attribute),
      changeColumn: async () =>
        sequelize.queryInterface.changeColumn('items', 'embedding', attribute),
    })) {
      it(`rejects VECTOR ${option} before ${name} executes SQL`, async () => {
        const query = sinon.stub(sequelize, 'queryRaw');

        try {
          const error = await operation().catch((caughtError: unknown) => caughtError);
          expect(error).to.be.instanceOf(Error);
          expect((error as Error).message).to.equal(`Oracle VECTOR column embedding ${message}.`);
          expect(query.called).to.equal(false);
        } finally {
          query.restore();
        }
      });
    }
  }

  it('uses Oracle VECTOR bindings in insert and update queries', () => {
    const attributes = {
      embedding: {
        attributeName: 'embedding',
        columnName: 'embedding',
        fieldName: 'embedding',
        type: sequelize.normalizeDataType(DataTypes.VECTOR(3)),
      },
    };
    const insert = queryGenerator.insertQuery('items', { embedding: [1, 2, 3] }, attributes);
    const update = queryGenerator.updateQuery(
      'items',
      { embedding: [4, 5, 6] },
      { id: 1 },
      {},
      attributes,
    );

    expect(insert.bind?.sequelize_1).to.deep.equal(Float32Array.from([1, 2, 3]));
    expect(update.bind?.sequelize_1).to.deep.equal(Float32Array.from([4, 5, 6]));
  });

  for (const value of [Number.MAX_VALUE, -Number.MAX_VALUE]) {
    it(`rejects FLOAT32 overflow from ${value} when generating a bound INSERT`, () => {
      const attributes = {
        embedding: {
          attributeName: 'embedding',
          columnName: 'embedding',
          fieldName: 'embedding',
          type: sequelize.normalizeDataType(DataTypes.VECTOR(3)),
        },
      };

      // The source value is finite, but conversion to the driver's Float32Array would overflow.
      expect(() =>
        queryGenerator.insertQuery('items', { embedding: [1, value, 3] }, attributes),
      ).to.throw(ValidationErrorItem, 'VECTOR value overflows FLOAT32');
    });
  }

  it('preserves large finite FLOAT64 elements in bound INSERT values', () => {
    const attributes = {
      embedding: {
        attributeName: 'embedding',
        columnName: 'embedding',
        fieldName: 'embedding',
        type: sequelize.normalizeDataType(
          DataTypes.VECTOR({ dimensions: 2, elementType: 'float64' }),
        ),
      },
    };
    const value = [Number.MAX_VALUE, -Number.MAX_VALUE];
    const insert = queryGenerator.insertQuery('items', { embedding: value }, attributes);

    expect(insert.bind?.sequelize_1).to.deep.equal(Float64Array.from(value));
  });

  it('reads VECTOR_INFO when the connected database supports vectors', () => {
    sequelize.setDatabaseVersion('23.26.0');

    expect(queryGenerator.describeTableQuery('items')).to.include('atc.VECTOR_INFO');
  });

  it('does not read VECTOR_INFO when the database version is unknown or too old', () => {
    const unknownVersionSequelize = new Sequelize({ dialect: OracleDialect });
    const oldVersionSequelize = new Sequelize({ dialect: OracleDialect });
    oldVersionSequelize.setDatabaseVersion('21.3.0');

    expect(unknownVersionSequelize.queryGenerator.describeTableQuery('items')).not.to.include(
      'atc.VECTOR_INFO',
    );
    expect(oldVersionSequelize.queryGenerator.describeTableQuery('items')).not.to.include(
      'atc.VECTOR_INFO',
    );
  });
});
