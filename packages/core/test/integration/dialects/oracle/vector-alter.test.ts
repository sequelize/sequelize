import type { AttributeOptions, DataType, IndexOptions } from '@sequelize/core';
import { DataTypes, Model, QueryTypes, sql } from '@sequelize/core';
import { expect } from 'chai';
import { getTestDialectTeaser, sequelize, skipSuiteIfOracleVersionBelow } from '../../support';

describe(getTestDialectTeaser('Oracle VECTOR column alterations'), () => {
  if (sequelize.dialect.name !== 'oracle' || !sequelize.dialect.supports.dataTypes.VECTOR) {
    return;
  }

  skipSuiteIfOracleVersionBelow('23.4.0');

  const tableName = 'vector_column_options';

  // Oracle VECTOR schema restrictions (defaults, primary/foreign keys and MODIFY):
  // https://docs.oracle.com/en/database/oracle/oracle-database/26/vecse/create-tables-using-vector-data-type.html

  async function createOriginal(embedding: AttributeOptions | DataType = DataTypes.VECTOR(3)) {
    class OriginalItem extends Model {}

    OriginalItem.init(
      {
        id: { type: DataTypes.INTEGER, primaryKey: true },
        embedding,
      },
      { sequelize, tableName, timestamps: false },
    );
    await OriginalItem.sync({ force: true });

    return OriginalItem;
  }

  function changedModel(embedding: AttributeOptions | DataType, indexes: IndexOptions[] = []) {
    class ChangedItem extends Model {}

    ChangedItem.init(
      {
        id: { type: DataTypes.INTEGER, primaryKey: true },
        embedding,
      },
      { sequelize, tableName, timestamps: false, indexes },
    );

    return ChangedItem;
  }

  for (const [name, type] of [
    ['element type', DataTypes.VECTOR({ dimensions: 3, elementType: 'float64' })],
    ['flexible dimensions', DataTypes.VECTOR()],
  ] as const) {
    it(`rejects changing VECTOR ${name} and preserves the existing definition`, async () => {
      await createOriginal();

      await expect(changedModel(type).sync({ alter: true })).to.be.rejectedWith(
        'Use an explicit migration',
      );
      const description = await sequelize.queryInterface.describeTable(tableName);
      expect(description.embedding.type).to.equal('VECTOR(3, FLOAT32)');
    });
  }

  for (const [name, options, message] of [
    ['array default', { defaultValue: [1, 2, 3] }, 'does not support database defaults'],
    [
      'SQL default',
      { defaultValue: sql.literal("TO_VECTOR('[1,2,3]', 3, FLOAT32)") },
      'does not support database defaults',
    ],
    ['NULL default', { defaultValue: null }, 'does not support database defaults'],
    ['primary key', { primaryKey: true }, 'cannot be used as a primary key'],
    ['unique constraint', { unique: true }, 'cannot be used in a non-vector index'],
    [
      'foreign key',
      { references: { table: tableName, key: 'id' } },
      'cannot be used as a foreign key',
    ],
    ['auto increment', { autoIncrement: true }, 'does not support autoIncrement'],
  ] as const) {
    it(`rejects a VECTOR ${name} before sync executes SQL`, async () => {
      await createOriginal();
      const statements: string[] = [];
      await expect(
        changedModel({ type: DataTypes.VECTOR(3), ...options }).sync({
          alter: true,
          logging: statement => statements.push(statement),
        }),
      ).to.be.rejectedWith(`Oracle VECTOR column embedding ${message}.`);
      expect(statements).to.deep.equal([]);
    });
  }

  for (const [name, attributeOptions, indexes] of [
    ['attribute uniqueness', { unique: true }, []],
    ['attribute index', { index: true }, []],
    ['model unique index', {}, [{ unique: true, fields: ['embedding'] }]],
    ['model ordinary index', {}, [{ fields: [{ name: 'embedding' }] }]],
    ['composite index', {}, [{ fields: ['id', 'embedding'] }]],
  ] satisfies Array<[string, object, IndexOptions[]]>) {
    for (const syncOptions of [{ alter: true }, { force: true, hooks: false }]) {
      it(`rejects VECTOR ${name} without SQL or data loss with ${JSON.stringify(syncOptions)}`, async () => {
        const Original = await createOriginal();
        await Original.create({ id: 1, embedding: [1, 2, 3] });
        const statements: string[] = [];

        await expect(
          changedModel({ type: DataTypes.VECTOR(3), ...attributeOptions }, indexes).sync({
            ...syncOptions,
            logging: statement => statements.push(statement),
          }),
        ).to.be.rejectedWith(
          'Oracle VECTOR column embedding cannot be used in a non-vector index.',
        );

        // Rejection must happen before ALTER or DROP, not after Oracle rejects CREATE INDEX.
        expect(statements).to.deep.equal([]);
        expect((await Original.findByPk(1))?.get('embedding')).to.deep.equal([1, 2, 3]);
        const description = await sequelize.queryInterface.describeTable(tableName);
        expect(description.embedding.type).to.equal('VECTOR(3, FLOAT32)');
      });
    }
  }

  for (const unique of [true, false]) {
    it(`rejects direct VECTOR indexes with unique: ${unique} before index DDL`, async () => {
      const Original = await createOriginal();
      await Original.create({ id: 1, embedding: [1, 2, 3] });
      const statements: string[] = [];

      await expect(
        sequelize.queryInterface.addIndex(tableName, {
          fields: ['embedding'],
          unique,
          logging: statement => statements.push(statement),
        }),
      ).to.be.rejectedWith('Oracle VECTOR column embedding cannot be used in a non-vector index.');

      // A direct migration needs a metadata SELECT, but must never send CREATE INDEX.
      expect(statements.length).to.be.greaterThan(0);
      expect(statements.every(statement => !/\b(?:CREATE|ALTER|DROP)\b/i.test(statement))).to.equal(
        true,
      );
      expect((await Original.findByPk(1))?.get('embedding')).to.deep.equal([1, 2, 3]);
    });
  }

  it('allows an ordinary index on a non-VECTOR column in the same table', async () => {
    await createOriginal();
    await sequelize.queryInterface.addColumn(tableName, 'label', DataTypes.STRING);
    await sequelize.queryInterface.addIndex(tableName, ['label'], {
      name: 'vector_items_label_idx',
    });
    const indexes = await sequelize.queryInterface.showIndex(tableName);
    expect(indexes.some(index => index.name === 'vector_items_label_idx')).to.equal(true);
  });

  it('rejects VECTOR uniqueness before bulk force sync can drop any table', async () => {
    const Original = await createOriginal();
    await Original.create({ id: 1, embedding: [1, 2, 3] });
    changedModel({ type: DataTypes.VECTOR(3), unique: true });
    const statements: string[] = [];

    await expect(
      sequelize.sync({ force: true, logging: statement => statements.push(statement) }),
    ).to.be.rejectedWith('Oracle VECTOR column embedding cannot be used in a non-vector index.');
    expect(statements).to.deep.equal([]);
    expect((await Original.findByPk(1))?.get('embedding')).to.deep.equal([1, 2, 3]);
  });

  it('rejects an invalid VECTOR before force sync can drop the existing table', async () => {
    const Original = await createOriginal();
    await Original.create({ id: 1, embedding: [1, 2, 3] });
    const statements: string[] = [];

    await expect(
      changedModel({ type: DataTypes.VECTOR(3), primaryKey: true }).sync({
        force: true,
        hooks: false,
        logging: statement => statements.push(statement),
      }),
    ).to.be.rejectedWith('Oracle VECTOR column embedding cannot be used as a primary key.');
    expect(statements).to.deep.equal([]);
    expect((await Original.findByPk(1))?.get('embedding')).to.deep.equal([1, 2, 3]);
  });

  it('allows JavaScript default factories and keeps database defaults unset', async () => {
    const Item = changedModel({ type: DataTypes.VECTOR(3), defaultValue: () => [1, 2, 3] });
    await Item.sync({ force: true });
    await Item.sync({ alter: true });
    const item = await Item.create({ id: 1 });
    await item.reload();

    expect(item.get('embedding')).to.deep.equal([1, 2, 3]);
    const rows = await sequelize.query<{ DATA_DEFAULT: string | null }>(
      'SELECT DATA_DEFAULT FROM USER_TAB_COLUMNS WHERE TABLE_NAME = :tableName AND COLUMN_NAME = :columnName',
      { replacements: { tableName, columnName: 'embedding' }, type: QueryTypes.SELECT },
    );
    expect(rows[0].DATA_DEFAULT).to.equal(null);
  });

  it('allows changing the read representation without changing the VECTOR column', async () => {
    const Original = await createOriginal();
    await Original.create({ id: 1, embedding: [1, 2, 3] });
    const Changed = changedModel(DataTypes.VECTOR({ dimensions: 3, typedArray: true }));

    await Changed.sync({ alter: true });
    expect((await Changed.findByPk(1))?.get('embedding')).to.deep.equal(
      new Float32Array([1, 2, 3]),
    );
  });

  it('rejects converting a scalar column to VECTOR and preserves its data', async () => {
    const Original = await createOriginal(DataTypes.INTEGER);
    await Original.create({ id: 1, embedding: 7 });

    await expect(changedModel(DataTypes.VECTOR(3)).sync({ alter: true })).to.be.rejectedWith(
      'Use an explicit migration',
    );
    expect((await Original.findByPk(1))?.get('embedding')).to.equal(7);
  });

  it('rejects converting VECTOR to a scalar column and preserves its data', async () => {
    const Original = await createOriginal();
    await Original.create({ id: 1, embedding: [1, 2, 3] });

    await expect(changedModel(DataTypes.INTEGER).sync({ alter: true })).to.be.rejected;
    expect((await Original.findByPk(1))?.get('embedding')).to.deep.equal([1, 2, 3]);
  });

  it('keeps data when a JavaScript attribute is renamed but its physical column stays the same', async () => {
    const Original = await createOriginal();
    await Original.create({ id: 1, embedding: [1, 2, 3] });

    class RenamedItem extends Model {}

    RenamedItem.init(
      {
        id: { type: DataTypes.INTEGER, primaryKey: true },
        renamedEmbedding: { type: DataTypes.VECTOR(3), columnName: 'embedding' },
      },
      { sequelize, tableName, timestamps: false },
    );

    await RenamedItem.sync({ alter: true });
    expect((await RenamedItem.findByPk(1))?.get('renamedEmbedding')).to.deep.equal([1, 2, 3]);
  });
});
