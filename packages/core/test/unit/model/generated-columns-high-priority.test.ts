import { DataTypes, Model, sql } from '@sequelize/core';
import { Attribute, DeletedAt, Generated } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import sinon from 'sinon';
import { sequelize } from '../../support';

const generatedColumnSupport = sequelize.dialect.supports.generatedColumns;
const supportedMode = generatedColumnSupport.stored ? 'STORED' : 'VIRTUAL';
const supportsGeneratedColumns = generatedColumnSupport.stored || generatedColumnSupport.virtual;

class TestTransaction {
  getConnectionIfExists() {
    return undefined;
  }
}

class TestConnection {}

describe('Model generated column safeguards', () => {
  afterEach(() => {
    sinon.restore();
  });

  for (const [attributeName, options] of [
    ['createdAt', {}],
    ['updatedAt', {}],
  ] as const) {
    it(`rejects a generated Sequelize-managed ${attributeName} attribute`, () => {
      expect(() => {
        sequelize.define(
          `Generated${attributeName}`,
          {
            [attributeName]: {
              type: DataTypes.DATE,
              generatedAs: sql.literal('NULL'),
            },
          },
          options,
        );
      }).to.throw(new RegExp(`${attributeName}.*Sequelize-managed timestamp.*generated`, 'i'));
    });
  }

  it('rejects a generated paranoid deletedAt attribute configured with decorators', () => {
    class GeneratedDeletedAt extends Model {
      @Attribute(DataTypes.DATE)
      @Generated(sql.literal('NULL'))
      @DeletedAt
      declare destroyedAt: Date | null;
    }

    expect(() => {
      sequelize.addModels([GeneratedDeletedAt]);
    }).to.throw(/destroyedAt.*Sequelize-managed timestamp.*generated/i);
  });

  if (supportsGeneratedColumns) {
    describe('foreign key constraints', () => {
      function defineModels() {
        const Parent = sequelize.define('GeneratedForeignKeyParent', {}, { timestamps: false });
        const Child = sequelize.define(
          'GeneratedForeignKeyChild',
          {
            parentSeed: DataTypes.INTEGER,
            parentId: {
              type: DataTypes.INTEGER,
              generatedAs: sql.literal('parentSeed'),
              generatedColumn: supportedMode,
            },
          },
          { timestamps: false },
        );

        return { Child, Parent };
      }

      it('uses the dialect non-mutating referential actions by default', () => {
        const { Child, Parent } = defineModels();

        Child.belongsTo(Parent, { foreignKey: 'parentId' });

        const parentId = Child.getAttributes().parentId;
        expect(parentId.onDelete).to.equal(undefined);
        expect(parentId.onUpdate).to.equal(undefined);
      });

      it('rejects ON DELETE actions that write to the generated foreign key', () => {
        const { Child, Parent } = defineModels();

        expect(() => {
          Child.belongsTo(Parent, {
            foreignKey: { name: 'parentId', onDelete: 'SET NULL' },
          });
        }).to.throwWithCause(/generated foreign key.*ON DELETE SET NULL/i);
      });

      it('rejects ON UPDATE actions that write to the generated foreign key', () => {
        const { Child, Parent } = defineModels();

        expect(() => {
          Child.belongsTo(Parent, {
            foreignKey: { name: 'parentId', onUpdate: 'CASCADE' },
          });
        }).to.throwWithCause(/generated foreign key.*ON UPDATE CASCADE/i);
      });
    });

    describe('association mutators', () => {
      function defineBelongsTo() {
        const Parent = sequelize.define('GeneratedBelongsToParent', {}, { timestamps: false });
        const Child = sequelize.define(
          'GeneratedBelongsToChild',
          {
            parentSeed: DataTypes.INTEGER,
            parentId: {
              type: DataTypes.INTEGER,
              generatedAs: sql.literal('parentSeed'),
              generatedColumn: supportedMode,
            },
          },
          { timestamps: false },
        );
        const association = Child.belongsTo(Parent, { foreignKey: 'parentId' });

        return { association, Child, Parent };
      }

      function defineHasOne() {
        const Parent = sequelize.define('GeneratedHasOneParent', {}, { timestamps: false });
        const Child = sequelize.define(
          'GeneratedHasOneChild',
          {
            parentSeed: DataTypes.INTEGER,
            parentId: {
              type: DataTypes.INTEGER,
              generatedAs: sql.literal('parentSeed'),
              generatedColumn: supportedMode,
            },
          },
          { timestamps: false },
        );
        const association = Parent.hasOne(Child, { foreignKey: 'parentId' });

        return { association, Child, Parent };
      }

      function defineHasMany() {
        const Parent = sequelize.define('GeneratedHasManyParent', {}, { timestamps: false });
        const Child = sequelize.define(
          'GeneratedHasManyChild',
          {
            parentSeed: DataTypes.INTEGER,
            parentId: {
              type: DataTypes.INTEGER,
              generatedAs: sql.literal('parentSeed'),
              generatedColumn: supportedMode,
            },
          },
          { timestamps: false },
        );
        const association = Parent.hasMany(Child, { foreignKey: 'parentId' });

        return { association, Child, Parent };
      }

      it('rejects belongsTo#set before changing the source instance', async () => {
        const { association, Child } = defineBelongsTo();
        const child = Child.build({ parentSeed: 1 });

        await expect(association.set(child, 2, { save: false })).to.be.rejectedWith(
          /association mutator.*parentId.*generated/i,
        );
        expect(child.get('parentId')).to.equal(undefined);
      });

      it('rejects belongsTo#create before creating an orphan target', async () => {
        const { association, Child, Parent } = defineBelongsTo();
        const create = sinon.stub(Parent, 'create');

        await expect(association.create(Child.build({ parentSeed: 1 }))).to.be.rejectedWith(
          /association mutator.*parentId.*generated/i,
        );
        expect(create).not.to.have.been.called;
      });

      it('rejects hasOne#set before reading or changing the existing association', async () => {
        const { association, Child, Parent } = defineHasOne();
        const get = sinon.stub(association, 'get').resolves(null);

        await expect(
          association.set(Parent.build(), Child.build({ parentSeed: 1 })),
        ).to.be.rejectedWith(/association mutator.*parentId.*generated/i);
        expect(get).not.to.have.been.called;
      });

      it('rejects hasOne#create before creating an orphan target', async () => {
        const { association, Child, Parent } = defineHasOne();
        const create = sinon.stub(Child, 'create');

        await expect(association.create(Parent.build())).to.be.rejectedWith(
          /association mutator.*parentId.*generated/i,
        );
        expect(create).not.to.have.been.called;
      });

      for (const mutator of ['set', 'add', 'remove'] as const) {
        it(`rejects hasMany#${mutator} before querying or updating targets`, async () => {
          const { association, Child, Parent } = defineHasMany();
          const parent = Parent.build();
          const child = Child.build({ id: 1, parentSeed: 1 }, { isNewRecord: false });
          const get = sinon.stub(association, 'get').resolves([]);
          const update = sinon.stub(Child, 'update');

          await expect(association[mutator](parent, [child])).to.be.rejectedWith(
            /association mutator.*parentId.*generated/i,
          );
          expect(get).not.to.have.been.called;
          expect(update).not.to.have.been.called;
        });
      }

      it('rejects hasMany#create before creating an orphan target', async () => {
        const { association, Child, Parent } = defineHasMany();
        const create = sinon.stub(Child, 'create');

        await expect(association.create(Parent.build())).to.be.rejectedWith(
          /association mutator.*parentId.*generated/i,
        );
        expect(create).not.to.have.been.called;
      });
    });

    describe('belongsToMany association mutators', () => {
      function defineBelongsToMany(generatedForeignKey: 'sourceId' | 'targetId') {
        const Source = sequelize.define('GeneratedBelongsToManySource', {}, { timestamps: false });
        const Target = sequelize.define('GeneratedBelongsToManyTarget', {}, { timestamps: false });
        const Through = sequelize.define(
          'GeneratedBelongsToManyThrough',
          {
            id: {
              type: DataTypes.INTEGER,
              autoIncrement: true,
              primaryKey: true,
            },
            [`${generatedForeignKey}Seed`]: DataTypes.INTEGER,
            [generatedForeignKey]: {
              type: DataTypes.INTEGER,
              generatedAs: sql.literal(`${generatedForeignKey}Seed`),
              generatedColumn: supportedMode,
            },
          },
          { timestamps: false },
        );
        const association = Source.belongsToMany(Target, {
          through: Through,
          foreignKey: 'sourceId',
          otherKey: 'targetId',
        });

        return { association, Source, Target, Through };
      }

      for (const mutator of ['set', 'add'] as const) {
        it(`rejects belongsToMany#${mutator} before accessing the through model`, async () => {
          const { association, Source, Target, Through } = defineBelongsToMany('sourceId');
          const findAll = sinon.stub(Through, 'findAll');
          const bulkCreate = sinon.stub(Through, 'bulkCreate');

          await expect(
            association[mutator](
              Source.build({ id: 1 }, { isNewRecord: false }),
              Target.build({ id: 2 }, { isNewRecord: false }),
            ),
          ).to.be.rejectedWith(/association mutator.*sourceId.*generated/i);
          expect(findAll).not.to.have.been.called;
          expect(bulkCreate).not.to.have.been.called;
        });
      }

      it('allows belongsToMany#add with no targets as a no-op', async () => {
        const { association, Source, Through } = defineBelongsToMany('sourceId');
        const findAll = sinon.stub(Through, 'findAll');

        await association.add(Source.build({ id: 1 }, { isNewRecord: false }), []);

        expect(findAll).not.to.have.been.called;
      });

      it('allows belongsToMany#set with no targets because it only deletes through rows', async () => {
        const { association, Source, Through } = defineBelongsToMany('sourceId');
        const findAll = sinon.stub(Through, 'findAll').resolves([]);
        const destroy = sinon.stub(Through, 'destroy');

        await association.set(Source.build({ id: 1 }, { isNewRecord: false }), [] as never);

        expect(findAll).to.have.been.calledOnce;
        expect(destroy).not.to.have.been.called;
      });

      it('rejects a generated otherKey before accessing the through model', async () => {
        const { association, Source, Target, Through } = defineBelongsToMany('targetId');
        const findAll = sinon.stub(Through, 'findAll');

        await expect(
          association.add(
            Source.build({ id: 1 }, { isNewRecord: false }),
            Target.build({ id: 2 }, { isNewRecord: false }),
          ),
        ).to.be.rejectedWith(/association mutator.*targetId.*generated/i);
        expect(findAll).not.to.have.been.called;
      });

      it('rejects belongsToMany#create before creating an orphan target', async () => {
        const { association, Source, Target } = defineBelongsToMany('sourceId');
        const create = sinon.stub(Target, 'create');

        await expect(
          association.create(Source.build({ id: 1 }, { isNewRecord: false })),
        ).to.be.rejectedWith(/association mutator.*sourceId.*generated/i);
        expect(create).not.to.have.been.called;
      });

      it('allows belongsToMany#remove because it deletes rather than writes through keys', async () => {
        const { association, Source, Target, Through } = defineBelongsToMany('sourceId');
        const destroy = sinon.stub(Through, 'destroy').resolves(1);

        await association.remove(
          Source.build({ id: 1 }, { isNewRecord: false }),
          Target.build({ id: 2 }, { isNewRecord: false }),
        );

        expect(destroy).to.have.been.calledOnce;
      });

      for (const method of ['create', 'bulkCreate'] as const) {
        it(`preflights belongsToMany includes before Model.${method} inserts anything`, async () => {
          const { association, Source } = defineBelongsToMany('sourceId');
          const insert = sinon.stub(sequelize.queryInterface, 'insert');
          const bulkInsert = sinon.stub(sequelize.queryInterface, 'bulkInsert');
          const values = { [association.as]: [{}] };

          const operation =
            method === 'create'
              ? Source.create(values, { include: [association] })
              : Source.bulkCreate([values], { include: [association] });

          await expect(operation).to.be.rejectedWith(/association mutator.*sourceId.*generated/i);
          expect(insert).not.to.have.been.called;
          expect(bulkInsert).not.to.have.been.called;
        });
      }

      it('allows a root belongsToMany include with no associated targets', async () => {
        const { association, Source } = defineBelongsToMany('sourceId');
        const insert = sinon
          .stub(sequelize.queryInterface, 'insert')
          .callsFake(async instance => [instance, 1]);

        const instance = await Source.create({}, { include: [association] });

        expect(insert).to.have.been.calledOnce;
        expect(instance.isNewRecord).to.equal(false);
      });

      it('rejects a nested declared belongsToMany include before inserting its outer parent', async () => {
        const { association, Source } = defineBelongsToMany('sourceId');
        const Outer = sequelize.define('GeneratedBelongsToManyOuter', {}, { timestamps: false });
        const children = Outer.hasMany(Source, { foreignKey: 'outerId' });
        const childHook = sinon.spy(instances => {
          instances[0].set(association.as, [{}]);
        });
        Source.beforeBulkCreate(childHook);
        const insert = sinon.stub(sequelize.queryInterface, 'insert');
        const bulkInsert = sinon.stub(sequelize.queryInterface, 'bulkInsert');

        await expect(
          Outer.bulkCreate([{ [children.as]: [{}] }], {
            include: [{ association: children, include: [association] }],
          }),
        ).to.be.rejectedWith(/association mutator.*sourceId.*generated/i);
        expect(childHook).not.to.have.been.called;
        expect(insert).not.to.have.been.called;
        expect(bulkInsert).not.to.have.been.called;
      });
    });

    it('ignores generated attributes before invoking custom setters', () => {
      let setterCalls = 0;
      const TestModel = sequelize.define(
        'GeneratedCustomSetter',
        {
          source: DataTypes.INTEGER,
          computed: {
            type: DataTypes.INTEGER,
            generatedAs: sql.literal('source + 1'),
            generatedColumn: supportedMode,
            set(value: number) {
              setterCalls++;
              this.setDataValue('source', value);
            },
          },
        },
        { timestamps: false },
      );

      const instance = TestModel.build({ computed: 41 });
      instance.set('computed', 42);

      expect(setterCalls).to.equal(0);
      expect(instance.getDataValue('source')).to.equal(undefined);
      expect(instance.getDataValue('computed')).to.equal(undefined);

      instance.set('computed', 43, { raw: true, comesFromDatabase: true });
      expect(instance.getDataValue('computed')).to.equal(43);
    });

    it('rebuilds generated and managed readonly attributes during refreshAttributes', () => {
      const TestModel = sequelize.define(
        'GeneratedRefreshReadonly',
        {
          source: DataTypes.INTEGER,
          computed: {
            type: DataTypes.INTEGER,
            generatedAs: sql.literal('source + 1'),
            generatedColumn: supportedMode,
          },
        },
        { version: true },
      );
      const modelDefinition = TestModel.modelDefinition;

      expect([...modelDefinition.readOnlyAttributeNames]).to.include.members([
        'computed',
        'createdAt',
        'updatedAt',
        'version',
      ]);

      delete modelDefinition.rawAttributes.computed.generatedAs;
      delete modelDefinition.rawAttributes.computed.generatedColumn;
      modelDefinition.refreshAttributes();

      expect(modelDefinition.generatedAttributeNames.has('computed')).to.equal(false);
      expect(modelDefinition.readOnlyAttributeNames.has('computed')).to.equal(false);
      expect([...modelDefinition.readOnlyAttributeNames]).to.include.members([
        'createdAt',
        'updatedAt',
        'version',
      ]);

      const instance = TestModel.build({}, { isNewRecord: false });
      instance.set('computed', 7);
      expect(instance.getDataValue('computed')).to.equal(7);
    });

    it('issues an empty insert for new records with only generated attributes', async () => {
      const TestModel = sequelize.define(
        'GeneratedOnlyRecord',
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: sequelize.dialect.name !== 'mariadb',
            generatedAs: sql.literal('1'),
            generatedColumn: supportedMode,
          },
        },
        { noPrimaryKey: sequelize.dialect.name === 'mariadb', timestamps: false },
      );
      let insertedValues: Record<string, unknown> | undefined;
      const insert = sinon
        .stub(sequelize.queryInterface, 'insert')
        .callsFake(async (instance, _tableName, values) => {
          insertedValues = { ...values };

          return [instance, 1];
        });
      const instance = TestModel.build();

      await instance.save({ hooks: false, validate: false });

      expect(insert).to.have.been.calledOnce;
      expect(insertedValues).to.deep.equal({});
      expect(instance.isNewRecord).to.equal(false);
    });

    it('issues one returning-capable insert per generated-only bulk row', async () => {
      const TestModel = sequelize.define(
        'GeneratedOnlyBulkRecords',
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: sequelize.dialect.name !== 'mariadb',
            generatedAs: sql.literal('1'),
            generatedColumn: supportedMode,
          },
        },
        { noPrimaryKey: sequelize.dialect.name === 'mariadb', timestamps: false },
      );
      const bulkInsert = sinon.stub(sequelize.queryInterface, 'bulkInsert');
      const transaction = new TestTransaction();
      const managedTransaction = sinon.stub(sequelize, 'transaction');
      let nextId = 1;
      const insert = sinon
        .stub(sequelize.queryInterface, 'insert')
        .callsFake(async (instance, _tableName, values, options) => {
          expect(values).to.deep.equal({});
          expect(options?.returning).to.equal(true);
          instance!.setDataValue('id', nextId++);

          return [instance, 1];
        });

      const instances = await TestModel.bulkCreate([{}, {}], {
        hooks: false,
        transaction: transaction as never,
        validate: false,
      });

      expect(insert).to.have.been.calledTwice;
      expect(bulkInsert).not.to.have.been.called;
      expect(managedTransaction).not.to.have.been.called;
      expect(instances.map(instance => instance.getDataValue('id'))).to.deep.equal([1, 2]);
      expect(instances.every(instance => !instance.isNewRecord)).to.equal(true);
    });

    it('rejects an empty-row bulk fallback on a bare connection before inserting', async () => {
      const TestModel = sequelize.define(
        'GeneratedOnlyBareConnectionBulkRecords',
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: sequelize.dialect.name !== 'mariadb',
            generatedAs: sql.literal('1'),
            generatedColumn: supportedMode,
          },
        },
        { noPrimaryKey: sequelize.dialect.name === 'mariadb', timestamps: false },
      );
      const insert = sinon.stub(sequelize.queryInterface, 'insert');
      const bulkInsert = sinon.stub(sequelize.queryInterface, 'bulkInsert');
      const managedTransaction = sinon.stub(sequelize, 'transaction');

      await expect(
        TestModel.bulkCreate([{}, {}], {
          connection: {} as never,
          hooks: false,
          validate: false,
        } as never),
      ).to.be.rejectedWith(/connection.*without a transaction/i);

      expect(insert).not.to.have.been.called;
      expect(bulkInsert).not.to.have.been.called;
      expect(managedTransaction).not.to.have.been.called;
    });

    it('allows one empty row on a bare connection without a managed transaction', async () => {
      const TestModel = sequelize.define(
        'GeneratedOnlySingleBareConnectionBulkRecord',
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: sequelize.dialect.name !== 'mariadb',
            generatedAs: sql.literal('1'),
            generatedColumn: supportedMode,
          },
        },
        { noPrimaryKey: sequelize.dialect.name === 'mariadb', timestamps: false },
      );
      const connection = new TestConnection();
      const insert = sinon
        .stub(sequelize.queryInterface, 'insert')
        .callsFake(async instance => [instance, 1]);
      const managedTransaction = sinon.stub(sequelize, 'transaction');

      const [instance] = await TestModel.bulkCreate([{}], {
        connection: connection as never,
        hooks: false,
        validate: false,
      } as never);

      expect(insert).to.have.been.calledOnce;
      expect(insert.firstCall.args[3]?.connection).to.equal(connection);
      expect(managedTransaction).not.to.have.been.called;
      expect(instance.isNewRecord).to.equal(false);
    });

    it('preserves bulk options and order when only some rows become empty', async () => {
      const TestModel = sequelize.define(
        'GeneratedMixedEmptyBulkRecords',
        {
          id: {
            type: DataTypes.INTEGER,
            columnName: 'generated_id',
            primaryKey: sequelize.dialect.name !== 'mariadb',
            generatedAs: sql.literal('1'),
            generatedColumn: supportedMode,
          },
          source: DataTypes.INTEGER,
        },
        { noPrimaryKey: sequelize.dialect.name === 'mariadb', timestamps: false },
      );
      const bulkInsert = sinon.stub(sequelize.queryInterface, 'bulkInsert');
      const insertedValues: Array<Record<string, unknown>> = [];
      const insertOptions: Array<Record<string, unknown>> = [];
      let nextId = 1;
      const insert = sinon
        .stub(sequelize.queryInterface, 'insert')
        .callsFake(async (instance, _tableName, values, options) => {
          insertedValues.push({ ...values });
          insertOptions.push({ ...options });
          instance!.setDataValue('id', nextId++);

          return [instance, 1];
        });
      const options: Record<string, unknown> = { returning: ['id'] };
      const transaction = new TestTransaction();
      options.transaction = transaction;
      if (sequelize.dialect.supports.inserts.ignoreDuplicates !== false) {
        options.ignoreDuplicates = true;
      }

      if (sequelize.dialect.supports.inserts.updateOnDuplicate) {
        options.updateOnDuplicate = ['source'];
      }

      const instances = await TestModel.bulkCreate([{}, { source: 2 }], options);

      expect(insert).to.have.been.calledTwice;
      expect(bulkInsert).not.to.have.been.called;
      expect(insertedValues).to.deep.equal([{}, { source: 2 }]);
      expect(insertOptions.map(option => option.returning)).to.deep.equal([
        ['generated_id'],
        ['generated_id'],
      ]);
      expect(insertOptions.map(option => option.ignoreDuplicates)).to.deep.equal([
        options.ignoreDuplicates ?? false,
        options.ignoreDuplicates ?? false,
      ]);
      expect(insertOptions.map(option => option.transaction)).to.deep.equal([
        transaction,
        transaction,
      ]);
      if (options.updateOnDuplicate) {
        expect(insertOptions.map(option => option.updateOnDuplicate)).to.deep.equal([
          ['source'],
          ['source'],
        ]);
      }

      expect(instances.map(instance => instance.getDataValue('id'))).to.deep.equal([1, 2]);
    });

    it('uses a valid dialect default-values insert for generated-only rows', () => {
      const TestModel = sequelize.define(
        'GeneratedOnlyDefaultValuesSql',
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: sequelize.dialect.name !== 'mariadb',
            generatedAs: sql.literal('1'),
            generatedColumn: supportedMode,
          },
        },
        { noPrimaryKey: sequelize.dialect.name === 'mariadb', timestamps: false },
      );

      const { query } = sequelize.queryGenerator.insertQuery(
        TestModel.table,
        {},
        TestModel.getAttributes(),
        { returning: true },
      );

      expect(query).to.match(/DEFAULT VALUES|VALUES \(\)/i);
    });

    it('filters generated columns addressed by their physical column name', async () => {
      const TestModel = sequelize.define(
        'GeneratedPhysicalColumnUpdate',
        {
          source: DataTypes.INTEGER,
          computedValue: {
            type: DataTypes.INTEGER,
            columnName: 'computed_value',
            generatedAs: sql.literal('source + 1'),
            generatedColumn: supportedMode,
          },
        },
        { timestamps: false },
      );
      const bulkUpdate = sinon.stub(sequelize.queryInterface, 'bulkUpdate');

      const [affectedRows] = await TestModel.update({ computed_value: 99 } as never, {
        fields: ['computed_value'] as never,
        validate: false,
        where: { id: 1 },
      });

      expect(affectedRows).to.equal(0);
      expect(bulkUpdate).not.to.have.been.called;
    });

    it('filters physical generated column names injected by beforeBulkUpdate', async () => {
      const TestModel = sequelize.define(
        'GeneratedPhysicalColumnBulkHook',
        {
          source: DataTypes.INTEGER,
          computedValue: {
            type: DataTypes.INTEGER,
            columnName: 'computed_value',
            generatedAs: sql.literal('source + 1'),
            generatedColumn: supportedMode,
          },
        },
        { timestamps: false },
      );
      TestModel.beforeBulkUpdate(options => {
        options.attributes.computed_value = 99;
        options.fields!.push('computed_value');
      });
      const bulkUpdate = sinon.stub(sequelize.queryInterface, 'bulkUpdate').resolves();

      await TestModel.update({ source: 2 }, { validate: false, where: { id: 1 } });

      expect(bulkUpdate).to.have.been.calledOnce;
      expect(bulkUpdate.firstCall.args[1]).to.deep.equal({ source: 2 });
    });

    it('filters physical generated column names injected by beforeSave', async () => {
      const TestModel = sequelize.define(
        'GeneratedPhysicalColumnSaveHook',
        {
          source: DataTypes.INTEGER,
          computedValue: {
            type: DataTypes.INTEGER,
            columnName: 'computed_value',
            generatedAs: sql.literal('source + 1'),
            generatedColumn: supportedMode,
          },
        },
        { timestamps: false },
      );
      TestModel.beforeSave((instance, options) => {
        instance.setDataValue('computed_value' as never, 99);
        options.fields!.push('computed_value');
      });
      const update = sinon.stub(sequelize.queryInterface, 'update');
      const instance = TestModel.build({ id: 1, source: 2 }, { isNewRecord: false, raw: true });

      await instance.save({ validate: false });

      expect(update).not.to.have.been.called;
    });

    it('verifies existing generated columns during sync({ alter: true })', async () => {
      const TestModel = sequelize.define(
        'GeneratedSync',
        {
          source: DataTypes.INTEGER,
          computed: {
            type: DataTypes.INTEGER,
            generatedAs: sql.literal('source + 1'),
            generatedColumn: supportedMode,
          },
        },
        { timestamps: false },
      );
      const queryInterface = sequelize.queryInterface;
      sinon.stub(queryInterface, 'tableExists').resolves(true);
      sinon.stub(queryInterface, 'ensureEnums').resolves();
      sinon.stub(queryInterface, 'describeTable').resolves({
        id: {},
        source: {},
        computed:
          sequelize.dialect.name === 'sqlite3'
            ? {
                generatedAs: sql.literal('source + 1'),
                generatedColumn: supportedMode,
              }
            : {},
      });
      sinon.stub(queryInterface, 'showConstraints').resolves([]);
      const changeColumn = sinon.stub(queryInterface, 'changeColumn').resolves();
      sinon.stub(queryInterface, 'showIndex').resolves([]);

      const sync = TestModel.sync({ alter: true, hooks: false });

      if (sequelize.dialect.name !== 'sqlite3') {
        await expect(sync).to.be.rejectedWith(/generated column.*migration.*required/i);

        return;
      }

      await sync;

      expect(changeColumn).to.have.been.calledOnce;
      expect(changeColumn.firstCall.args[1]).to.equal('source');
    });

    if (sequelize.dialect.name === 'mssql') {
      it('verifies generated primary keys during sync({ alter: true })', async () => {
        const TestModel = sequelize.define(
          'GeneratedPrimaryKeySync',
          {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              generatedAs: sql.literal('1'),
              generatedColumn: 'STORED',
            },
          },
          { timestamps: false },
        );
        const queryInterface = sequelize.queryInterface;
        sinon.stub(queryInterface, 'tableExists').resolves(true);
        sinon.stub(queryInterface, 'ensureEnums').resolves();
        sinon.stub(queryInterface, 'describeTable').resolves({ id: {} });
        sinon.stub(queryInterface, 'showConstraints').resolves([]);
        const changeColumn = sinon.stub(queryInterface, 'changeColumn').resolves();
        sinon.stub(queryInterface, 'showIndex').resolves([]);

        await expect(TestModel.sync({ alter: true, hooks: false })).to.be.rejectedWith(
          /generated column.*migration.*required/i,
        );
        expect(changeColumn).not.to.have.been.called;
      });
    }

    if (sequelize.dialect.name === 'sqlite3') {
      it('converges generated column drift during sync({ alter: true })', async () => {
        const TestModel = sequelize.define(
          'GeneratedSyncDrift',
          {
            source: DataTypes.INTEGER,
            computed: {
              type: DataTypes.INTEGER,
              generatedAs: sql.literal('source + 1'),
              generatedColumn: supportedMode,
            },
          },
          { timestamps: false },
        );
        const queryInterface = sequelize.queryInterface;
        sinon.stub(queryInterface, 'tableExists').resolves(true);
        sinon.stub(queryInterface, 'ensureEnums').resolves();
        sinon.stub(queryInterface, 'describeTable').resolves({
          id: {},
          source: {},
          computed: {
            generatedAs: sql.literal('source + 2'),
            generatedColumn: supportedMode,
          },
        });
        sinon.stub(queryInterface, 'showConstraints').resolves([]);
        const changeColumn = sinon.stub(queryInterface, 'changeColumn').resolves();
        sinon.stub(queryInterface, 'showIndex').resolves([]);

        await TestModel.sync({ alter: true, hooks: false });

        expect(changeColumn).to.have.been.calledTwice;
        expect(changeColumn.secondCall.args[1]).to.equal('computed');
      });
    }

    if (sequelize.dialect.supports.inserts.updateOnDuplicate) {
      it('removes generated attributes from updateOnDuplicate', async () => {
        const TestModel = sequelize.define(
          'GeneratedBulkCreate',
          {
            source: DataTypes.INTEGER,
            computed: {
              type: DataTypes.INTEGER,
              generatedAs: sql.literal('source + 1'),
              generatedColumn: supportedMode,
            },
          },
          { timestamps: false },
        );
        const bulkInsert = sinon.stub(sequelize.queryInterface, 'bulkInsert').resolves([]);

        await TestModel.bulkCreate([{ source: 1 }], {
          updateOnDuplicate: ['source', 'computed'],
        });

        expect(bulkInsert.firstCall.args[2].updateOnDuplicate).to.deep.equal(['source']);
      });

      it('rejects updateOnDuplicate with only generated attributes', async () => {
        const TestModel = sequelize.define(
          'GeneratedBulkCreateOnly',
          {
            source: DataTypes.INTEGER,
            computed: {
              type: DataTypes.INTEGER,
              generatedAs: sql.literal('source + 1'),
              generatedColumn: supportedMode,
            },
          },
          { timestamps: false },
        );

        await expect(
          TestModel.bulkCreate([{ source: 1 }], { updateOnDuplicate: ['computed'] }),
        ).to.be.rejectedWith(/Generated columns are recomputed by the database/i);
      });

      it('removes a generated physical alias added by beforeBulkCreate', async () => {
        const TestModel = sequelize.define(
          'GeneratedBulkCreateHookAlias',
          {
            source: DataTypes.INTEGER,
            computedValue: {
              type: DataTypes.INTEGER,
              columnName: 'computed_value',
              generatedAs: sql.literal('source + 1'),
              generatedColumn: supportedMode,
            },
          },
          { timestamps: false },
        );
        TestModel.beforeBulkCreate((_instances, options) => {
          options.updateOnDuplicate!.push('computed_value' as never);
        });
        const bulkInsert = sinon.stub(sequelize.queryInterface, 'bulkInsert').resolves([]);

        await TestModel.bulkCreate([{ source: 1 }], { updateOnDuplicate: ['source'] });

        expect(bulkInsert.firstCall.args[2].updateOnDuplicate).to.deep.equal(['source']);
      });
    }
  }
});
