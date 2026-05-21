'use strict';

const { DataTypes, Op, QueryTypes, sql } = require('@sequelize/core');
const { expect } = require('chai');
const semver = require('semver');
const { getTestDialect, sequelize } = require('../../../support');

if (getTestDialect() === 'oracle') {
  describe('[Oracle Specific] vectors', () => {
    before(async function () {
      const rawVersion = await sequelize.fetchDatabaseVersion();
      const normalized = semver.coerce(rawVersion)?.version; // e.g. 23.26.0

      if (!normalized || !semver.gte(normalized, '23.4.0')) {
        this.skip();
      }
    });

    const seedModel = async (model, rows) => {
      await model.sync({ force: true });

      for (const row of rows) {
        await model.create(row);
      }
    };

    describe('findAll', () => {
      beforeEach(async function () {
        this.Item = sequelize.define('Item', {
          embeddings: DataTypes.VECTOR(4),
        });

        await seedModel(this.Item, [
          { embeddings: new Float32Array([1, 1, 1, 1]) },
          { embeddings: new Float32Array([1, 2, 3, 3]) },
        ]);
      });

      it('fetches rows', async function () {
        const result = await this.Item.findAll();
        expect(result).to.have.length(2);
      });

      it('returns typed arrays for vector column', async function () {
        const result = await this.Item.findAll();
        expect(result[0].getDataValue('embeddings').BYTES_PER_ELEMENT).to.equal(4);
      });
    });

    describe('similarity search functions', () => {
      beforeEach(async function () {
        this.Item = sequelize.define('Item', {
          embeddings: DataTypes.VECTOR(3),
        });

        await seedModel(this.Item, [
          { embeddings: new Float32Array([1, 1, 1]) },
          { embeddings: new Float32Array([5, 5, 5]) },
          { embeddings: new Float32Array([10, 10, 10]) },
          { embeddings: new Float32Array([1, 2, 3]) },
        ]);
      });

      it('supports cosine distance filtering', async function () {
        const queryVector = [1, 2, 3];
        const result = await this.Item.findAll({
          where: sql.where(
            sql.fn('COSINE_DISTANCE', sql.attribute('embeddings'), queryVector),
            Op.lt,
            0.01,
          ),
        });

        expect(result.length).to.equal(1);
      });

      it('supports inner product filtering', async function () {
        const queryVector = [1, 2, 3];
        const result = await this.Item.findAll({
          where: sql.where(
            sql.fn('INNER_PRODUCT', sql.attribute('embeddings'), queryVector),
            Op.gt,
            20,
          ),
        });

        expect(result.length).to.equal(2);
      });

      it('supports l1 distance filtering', async function () {
        const queryVector = [1, 2, 3];
        const result = await this.Item.findAll({
          where: sql.where(
            sql.fn('L1_DISTANCE', sql.attribute('embeddings'), queryVector),
            Op.lt,
            10,
          ),
        });

        expect(result.length).to.equal(3);
      });

      it('supports l2 distance filtering', async function () {
        const queryVector = [1, 2, 3];
        const result = await this.Item.findAll({
          where: sql.where(
            sql.fn('L2_DISTANCE', sql.attribute('embeddings'), queryVector),
            Op.lt,
            3,
          ),
        });

        expect(result.length).to.equal(2);
      });

      it('supports all helper methods in where filters', async function () {
        const queryVector = [1, 2, 3];
        const helperCases = [
          { name: 'cosineDistance', operator: Op.lt, threshold: 0.01, expected: 1 },
          { name: 'innerProduct', operator: Op.gt, threshold: 10, expected: 3 },
          { name: 'l1Distance', operator: Op.lt, threshold: 10, expected: 3 },
          { name: 'l2Distance', operator: Op.lt, threshold: 6, expected: 3 },
          { name: 'vectorDistance', operator: Op.lt, threshold: 0.01, expected: 1 },
        ];

        for (const helperCase of helperCases) {
          const result = await this.Item.findAll({
            where: sql.where(
              sequelize[helperCase.name]('embeddings', queryVector),
              helperCase.operator,
              helperCase.threshold,
            ),
          });

          expect(result.length, helperCase.name).to.equal(helperCase.expected);
        }
      });

      it('supports raw SQL bind parameters for VECTOR_DISTANCE query vectors', async () => {
        const rows = await sequelize.query(
          `SELECT "id" FROM "Items" WHERE VECTOR_DISTANCE("embeddings", $queryVector) < $threshold ORDER BY "id"`,
          {
            bind: {
              queryVector: Float32Array.from([1, 2, 3]),
              threshold: 0.05,
            },
            type: QueryTypes.SELECT,
          },
        );

        expect(rows).to.have.length(1);
        expect(rows[0].id).to.equal(4);
      });

      it('accepts valid VECTOR literal strings in vector functions', async function () {
        const result = await this.Item.findAll({
          where: sql.where(
            sql.fn('VECTOR_DISTANCE', sql.attribute('embeddings'), `VECTOR('[1,2,3]')`),
            Op.lt,
            2,
          ),
        });

        expect(result.length).to.equal(4);
      });

      it('rejects malformed VECTOR literal strings in vector functions', async function () {
        await expect(
          this.Item.findAll({
            where: sql.where(
              sql.fn('VECTOR_DISTANCE', sql.attribute('embeddings'), `VECTR('[1,2,3]')`),
              Op.lt,
              2,
            ),
          }),
        ).to.be.rejected;
      });

      it('rejects non-finite vector elements in vector functions', async function () {
        await expect(
          this.Item.findAll({
            where: sql.where(
              sql.fn('VECTOR_DISTANCE', sql.attribute('embeddings'), [1, Infinity, 3]),
              Op.lt,
              2,
            ),
          }),
        ).to.be.rejected;
      });

      it('rejects unsupported integer typed arrays as the query vector argument', async function () {
        await expect(
          this.Item.findAll({
            where: sql.where(
              sql.fn('VECTOR_DISTANCE', sql.attribute('embeddings'), new Int8Array([1, 2, 3])),
              Op.lt,
              2,
            ),
          }),
        ).to.be.rejected;
      });

      it('supports all vector helper methods in ORDER BY', async function () {
        const queryVector = [1, 2, 3];
        const helpers = [
          'cosineDistance',
          'innerProduct',
          'l1Distance',
          'l2Distance',
          'vectorDistance',
        ];

        for (const helper of helpers) {
          const result = await this.Item.findAll({
            order: [sequelize[helper]('embeddings', queryVector)],
            limit: 1,
          });

          expect(result).to.have.length(1);
        }
      });
    });

    describe('vector input validation and persistence', () => {
      beforeEach(async function () {
        this.Item = sequelize.define('VectorInputItem', {
          embeddings: DataTypes.VECTOR(3),
        });

        await this.Item.sync({ force: true });
      });

      for (const [name, value] of [
        ['number array', [1, 2, 3]],
        ['Float32Array', new Float32Array([1, 2, 3])],
        ['Float64Array', new Float64Array([1, 2, 3])],
        ['Int8Array', new Int8Array([1, 2, 3])],
      ]) {
        it(`accepts ${name} input`, async function () {
          await this.Item.create({ embeddings: value });

          const row = await this.Item.findOne();
          expect(Array.from(row.getDataValue('embeddings'))).to.deep.equal([1, 2, 3]);
        });
      }

      it('persists updates performed with a plain number array', async function () {
        const item = await this.Item.create({ embeddings: new Float32Array([1, 2, 3]) });

        await item.update({ embeddings: [4, 5, 6] });

        await item.reload();
        expect(Array.from(item.getDataValue('embeddings'))).to.deep.equal([4, 5, 6]);
      });

      for (const [name, value, error] of [
        ['DataView', new DataView(new ArrayBuffer(3)), 'is not a valid vector'],
        ['string', '1,2,3', 'is not a valid vector'],
        ['non-number array', [1, 'a', 3], 'ORA-51805'],
      ]) {
        it(`rejects ${name} input`, async function () {
          await expect(this.Item.create({ embeddings: value })).to.be.rejectedWith(Error, error);
        });
      }

      it('stores Uint8Array in binary vectors with matching bit-dimension', async () => {
        const BinaryItem = sequelize.define('BinaryVectorInputItem', {
          embeddings: DataTypes.VECTOR(24, 'binary'),
        });

        await BinaryItem.sync({ force: true });
        await BinaryItem.create({ embeddings: new Uint8Array([1, 2, 3]) });

        const row = await BinaryItem.findOne();
        expect(row).to.not.equal(null);
      });

      it('accepts object-style binary format options', async () => {
        const BinaryItem = sequelize.define('BinaryVectorInputItemObjectStyle', {
          embeddings: DataTypes.VECTOR({ dimension: 24, format: 'binary' }),
        });

        await BinaryItem.sync({ force: true });
        await BinaryItem.create({ embeddings: new Uint8Array([1, 2, 3]) });

        const row = await BinaryItem.findOne();
        expect(row).to.not.equal(null);
      });

      it('accepts uppercase binary format in constructor arguments', async () => {
        const BinaryItem = sequelize.define('BinaryVectorInputItemUppercase', {
          embeddings: DataTypes.VECTOR(24, 'BINARY'),
        });

        await BinaryItem.sync({ force: true });
        await BinaryItem.create({ embeddings: new Uint8Array([1, 2, 3]) });

        const row = await BinaryItem.findOne();
        expect(row).to.not.equal(null);
      });
    });

    describe('vector indexes', () => {
      it('creates vector index from model indexes option during sync', async () => {
        const indexName = 'vector_input_item_embeddings_hnsw_idx';
        const IndexedItem = sequelize.define(
          'VectorIndexedItem',
          {
            embeddings: DataTypes.VECTOR(3),
          },
          {
            indexes: [
              {
                name: indexName,
                type: 'VECTOR',
                fields: ['embeddings'],
                using: 'hnsw',
                parameter: { neighbor: 8, efconstruction: 32 },
              },
            ],
          },
        );

        try {
          await IndexedItem.sync({ force: true });

          const indexes = await sequelize.queryInterface.showIndex(IndexedItem.table);
          const vectorIndex = indexes.find(
            index => index.name?.toLowerCase() === indexName.toLowerCase(),
          );

          expect(vectorIndex).to.not.equal(undefined);
          expect(vectorIndex.type).to.equal('VECTOR');
        } finally {
          try {
            await sequelize.queryInterface.removeIndex(IndexedItem.table, indexName);
          } finally {
            await IndexedItem.drop();
          }
        }
      });

      it('rejects ordered vector index fields during sync', async () => {
        const IndexedItem = sequelize.define(
          'VectorOrderedIndexedItem',
          {
            embeddings: DataTypes.VECTOR(3),
          },
          {
            indexes: [
              {
                name: 'vector_input_item_embeddings_desc_idx',
                type: 'VECTOR',
                fields: [{ name: 'embeddings', order: 'desc' }],
                using: 'hnsw',
              },
            ],
          },
        );

        try {
          await expect(IndexedItem.sync({ force: true })).to.be.rejectedWith(
            'Oracle VECTOR indexes do not support ordered fields.',
          );
        } finally {
          await IndexedItem.drop();
        }
      });
    });
  });
}
