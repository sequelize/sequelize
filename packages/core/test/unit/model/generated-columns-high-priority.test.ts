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

    it('does not alter existing generated columns during sync({ alter: true })', async () => {
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
        computed: {},
      });
      sinon.stub(queryInterface, 'showConstraints').resolves([]);
      const changeColumn = sinon.stub(queryInterface, 'changeColumn').resolves();
      sinon.stub(queryInterface, 'showIndex').resolves([]);

      await TestModel.sync({ alter: true, hooks: false });

      expect(changeColumn).to.have.been.calledOnce;
      expect(changeColumn.firstCall.args[1]).to.equal('source');
    });

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
