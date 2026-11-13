import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  VectorElementType,
  VectorValue,
} from '@sequelize/core';
import { DataTypes, Model, ValidationErrorItem } from '@sequelize/core';
import { expect } from 'chai';
import {
  beforeEach2,
  getTestDialectTeaser,
  sequelize,
  skipSuiteIfOracleVersionBelow,
} from '../support';

const dialect = sequelize.dialect;

describe(getTestDialectTeaser('DataTypes.VECTOR'), () => {
  const vectorSupport = dialect.supports.dataTypes.VECTOR;
  if (!vectorSupport) {
    return;
  }

  skipSuiteIfOracleVersionBelow('23.4.0');

  const allVectorTestCases: ReadonlyArray<{
    elementType: VectorElementType;
    dimensions: number;
    initialValue: VectorValue;
    updatedValue: VectorValue;
    typedValue: VectorValue;
  }> = [
    {
      elementType: 'float16',
      dimensions: 3,
      initialValue: [1.25, 2.5, 3.75],
      updatedValue: [4, 5, 6],
      typedValue: new Float32Array([1.25, 2.5, 3.75]),
    },
    {
      elementType: 'float32',
      dimensions: 3,
      initialValue: [1.25, 2.5, 3.75],
      updatedValue: [4, 5, 6],
      typedValue: new Float32Array([1.25, 2.5, 3.75]),
    },
    {
      elementType: 'float64',
      dimensions: 3,
      initialValue: [Number.EPSILON, Math.PI, Math.E],
      updatedValue: [4, 5, 6],
      typedValue: new Float64Array([Number.EPSILON, Math.PI, Math.E]),
    },
    {
      elementType: 'int8',
      dimensions: 3,
      initialValue: [-128, 0, 127],
      updatedValue: [4, 5, 6],
      typedValue: new Int8Array([-128, 0, 127]),
    },
    {
      elementType: 'binary',
      dimensions: 24,
      initialValue: new Uint8Array([0b1010_1010, 0b0101_0101, 0b1111_0000]),
      updatedValue: new Uint8Array([1, 2, 3]),
      typedValue: new Uint8Array([0b1010_1010, 0b0101_0101, 0b1111_0000]),
    },
  ];
  const vectorTestCases = allVectorTestCases.filter(
    testCase => vectorSupport.elementTypes[testCase.elementType],
  );

  for (const testCase of vectorTestCases) {
    describe(`${testCase.elementType} vectors`, () => {
      const vars = beforeEach2(async () => {
        class VectorItem extends Model<
          InferAttributes<VectorItem>,
          InferCreationAttributes<VectorItem>
        > {
          declare id: CreationOptional<number>;
          declare embedding: VectorValue;
          declare typedEmbedding: VectorValue;
        }

        VectorItem.init(
          {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
            embedding: {
              type: DataTypes.VECTOR({
                dimensions: testCase.dimensions,
                elementType: testCase.elementType,
              }),
              columnName: 'embedding_value',
            },
            typedEmbedding: DataTypes.VECTOR({
              dimensions: testCase.dimensions,
              elementType: testCase.elementType,
              typedArray: true,
            }),
          },
          { sequelize, timestamps: false },
        );

        await VectorItem.sync({ force: true });

        return { VectorItem };
      });

      it('round-trips plain and typed values', async () => {
        const item = await vars.VectorItem.create({
          embedding: testCase.initialValue,
          typedEmbedding: testCase.initialValue,
        });

        await item.reload();

        if (testCase.elementType === 'binary') {
          expect(item.embedding).to.deep.equal(testCase.initialValue);
        } else {
          expect(item.embedding).to.deep.equal([...testCase.initialValue]);
        }

        expect(item.typedEmbedding).to.deep.equal(testCase.typedValue);
      });

      it('supports bulk inserts', async () => {
        await vars.VectorItem.bulkCreate([
          { embedding: testCase.initialValue, typedEmbedding: testCase.initialValue },
          { embedding: testCase.updatedValue, typedEmbedding: testCase.updatedValue },
        ]);

        expect(await vars.VectorItem.count()).to.equal(2);
      });

      it('updates and reloads a vector value', async () => {
        const item = await vars.VectorItem.create({
          embedding: testCase.initialValue,
          typedEmbedding: testCase.initialValue,
        });

        item.embedding = testCase.updatedValue;
        await item.save();
        await item.reload();

        if (testCase.elementType === 'binary') {
          expect(item.embedding).to.deep.equal(testCase.updatedValue);
        } else {
          expect(item.embedding).to.deep.equal([...testCase.updatedValue]);
        }
      });

      it('does not mark equal vectors as changed across array kinds', async () => {
        const item = await vars.VectorItem.create({
          embedding: testCase.initialValue,
          typedEmbedding: testCase.initialValue,
        });

        await item.reload();
        item.embedding = testCase.typedValue;

        expect(item.changed('embedding')).to.equal(false);
      });
    });
  }

  const largeVectorTestCase = vectorTestCases.find(
    testCase =>
      testCase.elementType !== 'binary' &&
      vectorSupport.elementTypes[testCase.elementType]!.maxDimensions >= 1536,
  );
  if (largeVectorTestCase) {
    it('round-trips a realistic 1536-dimension embedding', async () => {
      class Document extends Model<InferAttributes<Document>, InferCreationAttributes<Document>> {
        declare id: CreationOptional<number>;
        declare embedding: VectorValue;
      }

      Document.init(
        {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          embedding: DataTypes.VECTOR({
            dimensions: 1536,
            elementType: largeVectorTestCase.elementType,
          }),
        },
        { sequelize, timestamps: false },
      );
      await Document.sync({ force: true });

      const embedding = Array.from({ length: 1536 }, (_, index) => index / 1536);
      const document = await Document.create({ embedding });
      await document.reload();

      expect(document.embedding).to.have.length(1536);
      expect(document.embedding[1024]).to.be.closeTo(embedding[1024], 1e-6);
    });
  }

  const defaultVectorTestCase = vectorTestCases[0];
  if (defaultVectorTestCase) {
    it('allows sync({ alter: true }) when the VECTOR definition is unchanged', async () => {
      class VectorItem extends Model {}

      VectorItem.init(
        {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          embedding: DataTypes.VECTOR({
            dimensions: defaultVectorTestCase.dimensions,
            elementType: defaultVectorTestCase.elementType,
          }),
        },
        { sequelize, timestamps: false },
      );
      await VectorItem.sync({ force: true });

      await expect(VectorItem.sync({ alter: true })).to.be.fulfilled;
    });
  }

  if (dialect.name === 'oracle') {
    for (const value of [Number.MAX_VALUE, -Number.MAX_VALUE]) {
      it(`rejects FLOAT32 conversion overflow from ${value} before executing an INSERT`, async () => {
        class VectorItem extends Model {}

        VectorItem.init(
          {
            id: { type: DataTypes.INTEGER, primaryKey: true },
            embedding: DataTypes.VECTOR(1),
          },
          { sequelize, timestamps: false },
        );
        await VectorItem.sync({ force: true });
        const statements: string[] = [];

        // A finite input must not reach Oracle as an infinite FLOAT32 bind value.
        await expect(
          VectorItem.create(
            { id: 1, embedding: [value] },
            { logging: statement => statements.push(statement) },
          ),
        ).to.be.rejectedWith(ValidationErrorItem, 'VECTOR value overflows FLOAT32');
        expect(statements).to.deep.equal([]);
        expect(await VectorItem.count()).to.equal(0);
      });
    }

    for (const allowNull of [true, false]) {
      it(`preserves VECTOR nullability when sync({ alter: true }) rejects changing allowNull from ${allowNull} to ${!allowNull}`, async () => {
        class OriginalVectorItem extends Model {}

        OriginalVectorItem.init(
          {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            embedding: { type: DataTypes.VECTOR(3), allowNull },
          },
          { sequelize, tableName: 'vector_nullability_items', timestamps: false },
        );
        await OriginalVectorItem.sync({ force: true });
        const item = await OriginalVectorItem.create({ embedding: [1, 2, 3] });

        // Keeping the same nullability must not issue an unsupported VECTOR modification.
        await expect(OriginalVectorItem.sync({ alter: true })).to.be.fulfilled;

        class ChangedVectorItem extends Model {}

        ChangedVectorItem.init(
          {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            embedding: { type: DataTypes.VECTOR(3), allowNull: !allowNull },
          },
          { sequelize, tableName: 'vector_nullability_items', timestamps: false },
        );

        await expect(ChangedVectorItem.sync({ alter: true })).to.be.rejectedWith(
          'Changing nullability of Oracle VECTOR column embedding is not supported by sync({ alter: true }). Use an explicit migration.',
        );

        // Rejection must leave both the column definition and its stored value intact.
        const description = await sequelize.queryInterface.describeTable(
          'vector_nullability_items',
        );
        expect(description.embedding.allowNull).to.equal(allowNull);
        expect(description.embedding.type).to.equal('VECTOR(3, FLOAT32)');
        await item.reload();
        expect(item.get('embedding')).to.deep.equal([1, 2, 3]);
      });
    }

    it('rejects changing an existing VECTOR definition through sync({ alter: true })', async () => {
      class OriginalVectorItem extends Model {}

      OriginalVectorItem.init(
        {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          embedding: DataTypes.VECTOR(3),
        },
        { sequelize, tableName: 'vector_alter_items', timestamps: false },
      );
      await OriginalVectorItem.sync({ force: true });

      class ChangedVectorItem extends Model {}

      ChangedVectorItem.init(
        {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          embedding: DataTypes.VECTOR(4),
        },
        { sequelize, tableName: 'vector_alter_items', timestamps: false },
      );

      await expect(ChangedVectorItem.sync({ alter: true })).to.be.rejectedWith(
        'Changing Oracle VECTOR column embedding from VECTOR(3, FLOAT32) to VECTOR(4, FLOAT32) is not supported by sync({ alter: true })',
      );
    });
  }

  if (vectorSupport.optionalDimensions) {
    it('round-trips a vector without fixed dimensions', async () => {
      class FlexibleVectorItem extends Model<
        InferAttributes<FlexibleVectorItem>,
        InferCreationAttributes<FlexibleVectorItem>
      > {
        declare id: CreationOptional<number>;
        declare embedding: VectorValue;
      }

      FlexibleVectorItem.init(
        {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          embedding: DataTypes.VECTOR(),
        },
        { sequelize, timestamps: false },
      );
      await FlexibleVectorItem.sync({ force: true });

      const item = await FlexibleVectorItem.create({ embedding: [1, 2, 3, 4] });
      await item.reload();

      expect(item.embedding).to.deep.equal([1, 2, 3, 4]);
    });
  }
});
