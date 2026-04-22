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

  it('rejects a generated paranoid deletedAt attribute', () => {
    class GeneratedDeletedAt extends Model {
      @Attribute(DataTypes.DATE)
      @Generated(sql.literal('NULL'))
      @DeletedAt
      declare destroyedAt: Date | null;
    }

    expect(() => {
      sequelize.addModels([GeneratedDeletedAt]);
    }).to.throw(/deletedAt attribute cannot be a generated column/i);
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
