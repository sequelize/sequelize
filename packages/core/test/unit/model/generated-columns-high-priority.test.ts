import { DataTypes, Model, sql } from '@sequelize/core';
import { Attribute, DeletedAt, Generated } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import sinon from 'sinon';
import { sequelize } from '../../support';

const generatedColumnSupport = sequelize.dialect.supports.generatedColumns;
const supportedMode = generatedColumnSupport.stored ? 'STORED' : 'VIRTUAL';
const supportsGeneratedColumns = generatedColumnSupport.stored || generatedColumnSupport.virtual;

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
            primaryKey: true,
            generatedAs: sql.literal('1'),
            generatedColumn: supportedMode,
          },
        },
        { timestamps: false },
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
    }
  }
});
