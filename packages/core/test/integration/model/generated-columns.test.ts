import type {
  BaseSqlExpression,
  CreationOptional,
  GeneratedColumnOptions,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from '@sequelize/core';
import { DataTypes, ForeignKeyConstraintError, Model, sql } from '@sequelize/core';
import {
  Attribute,
  BelongsTo,
  GeneratedAs,
  NotNull,
  PrimaryKey,
  Table,
  Unique,
} from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import semver from 'semver';
import { sequelize } from '../support';

const dialect = sequelize.dialect;
const { stored, virtual } = dialect.supports.generatedColumns;

let modelCount = 0;

async function syncLineItem({
  generatedAs = sql`${sql.attribute('unitPrice')} * ${sql.attribute('quantity')}`,
  indexed = false,
  alter = false,
}: {
  generatedAs?: BaseSqlExpression | GeneratedColumnOptions;
  indexed?: boolean;
  alter?: boolean;
} = {}) {
  @Table({
    modelName: `LineItem${modelCount++}`,
    tableName: 'line_items',
    underscored: true,
    timestamps: false,
    indexes: indexed ? [{ fields: ['total'] }] : [],
  })
  class LineItem extends Model<InferAttributes<LineItem>, InferCreationAttributes<LineItem>> {
    declare id: CreationOptional<number>;

    @Attribute(DataTypes.INTEGER)
    @NotNull
    declare unitPrice: number;

    @Attribute(DataTypes.INTEGER)
    @NotNull
    declare quantity: number;

    @Attribute(DataTypes.INTEGER)
    @GeneratedAs(generatedAs)
    declare total: CreationOptional<number>;
  }

  sequelize.addModels([LineItem]);
  await LineItem.sync(alter ? { alter } : { force: true });

  return LineItem;
}

(stored || virtual ? describe : describe.skip)('Model generated columns', () => {
  before(function () {
    // generated columns were added in PostgreSQL 12
    if (dialect.name === 'postgres' && semver.lt(sequelize.getDatabaseVersion(), '12.0.0')) {
      this.skip();
    }
  });

  it('computes the value when the row is written', async () => {
    const LineItem = await syncLineItem();

    const item = await LineItem.create({ unitPrice: 3, quantity: 2, total: 100 });
    expect(item.total).to.equal(6);

    await item.update({ quantity: 5 });
    expect(item.total).to.equal(15);
    expect(item.changed()).to.equal(false);

    await item.reload();
    expect(item.total).to.equal(15);
  });

  it('only refreshes the generated attributes after an update', async () => {
    const LineItem = await syncLineItem();
    const { id } = await LineItem.create({ unitPrice: 3, quantity: 2 });

    // an unsaved change survives saving another attribute
    const item = (await LineItem.findByPk(id))!;
    item.unitPrice = 10;
    await item.update({ quantity: 5 });
    expect(item.total).to.equal(15);
    expect(item.unitPrice).to.equal(10);
    expect(item.changed()).to.deep.equal(['unitPrice']);

    // attributes left out of the query stay out
    const partial = (await LineItem.findByPk(id, { attributes: ['id', 'quantity'] }))!;
    await partial.update({ quantity: 6 });
    expect(partial.get({ plain: true })).to.deep.equal({ id, quantity: 6, total: 18 });
  });

  it('does not write generated attributes listed in fields', async () => {
    const LineItem = await syncLineItem();
    const item = await LineItem.create({ unitPrice: 3, quantity: 2 });

    item.quantity = 4;
    item.changed('total', true);
    await item.save({ fields: ['quantity', 'total'] });
    expect(item.total).to.equal(12);
  });

  it('reads the generated attributes back regardless of the default scope', async () => {
    const LineItem = await syncLineItem();
    LineItem.addScope('defaultScope', { where: { quantity: 1 } }, { override: true });

    const item = await LineItem.create({ unitPrice: 3, quantity: 2 });
    expect(item.total).to.equal(6);
    await item.update({ quantity: 4 });
    expect(item.total).to.equal(12);
  });

  it('does not write generated columns in bulkCreate', async () => {
    const LineItem = await syncLineItem();

    await LineItem.bulkCreate([
      { unitPrice: 2, quantity: 2, total: 100 },
      { unitPrice: 3, quantity: 3 },
    ]);

    const items = await LineItem.findAll({ order: ['id'] });
    expect(items.map(item => item.total)).to.deep.equal([4, 9]);
  });

  if (dialect.supports.inserts.updateOnDuplicate) {
    it('does not update generated columns in bulkCreate with updateOnDuplicate', async () => {
      const LineItem = await syncLineItem();
      const item = await LineItem.create({ unitPrice: 1, quantity: 1 });

      await LineItem.bulkCreate([{ id: item.id, unitPrice: 4, quantity: 1 }], {
        updateOnDuplicate: ['unitPrice', 'quantity', 'total'],
      });

      await item.reload();
      expect(item.total).to.equal(4);
    });
  }

  it('keeps generated columns through sync({ alter: true })', async () => {
    await (await syncLineItem({ indexed: true })).create({ unitPrice: 3, quantity: 2 });

    const LineItem = await syncLineItem({ indexed: true, alter: true });

    const created = await LineItem.create({ unitPrice: 5, quantity: 5 });
    const items = await LineItem.findAll({ order: ['id'] });
    expect(items.map(item => item.total)).to.deep.equal([6, 25]);
    expect(items[1].id).to.equal(created.id);
  });

  it('adds generated columns to existing tables with sync({ alter: true })', async () => {
    const OldLineItem = sequelize.define(
      'OldLineItem',
      {
        unitPrice: { type: DataTypes.INTEGER, allowNull: false },
        quantity: { type: DataTypes.INTEGER, allowNull: false },
      },
      { tableName: 'line_items', underscored: true, timestamps: false },
    );
    await OldLineItem.sync({ force: true });
    await OldLineItem.create({ unitPrice: 3, quantity: 2 });

    const LineItem = await syncLineItem({ alter: true });

    const [item] = await LineItem.findAll();
    expect(item.total).to.equal(6);
  });

  it('supports generated foreign keys, and foreign keys to generated columns', async () => {
    @Table({ modelName: 'GeneratedTenant', timestamps: false })
    class Tenant extends Model<InferAttributes<Tenant>, InferCreationAttributes<Tenant>> {
      @Attribute(DataTypes.INTEGER)
      @PrimaryKey
      declare id: number;

      @Attribute(DataTypes.STRING)
      @NotNull
      declare name: string;

      @Attribute(DataTypes.STRING)
      @Unique
      @GeneratedAs(sql`lower(${sql.attribute('name')})`)
      declare slug: CreationOptional<string>;

      declare documents?: NonAttribute<Document[]>;
    }

    @Table({ modelName: 'GeneratedDocument', timestamps: false })
    class Document extends Model<InferAttributes<Document>, InferCreationAttributes<Document>> {
      declare id: CreationOptional<number>;

      @Attribute(DataTypes.INTEGER)
      @NotNull
      declare externalTenantId: number;

      @Attribute(DataTypes.INTEGER)
      @GeneratedAs(sql`${sql.attribute('externalTenantId')} - 1000`)
      declare tenantId: CreationOptional<number>;

      @BelongsTo(() => Tenant, {
        foreignKey: 'tenantId',
        inverse: { as: 'documents', type: 'hasMany' },
      })
      declare tenant?: NonAttribute<Tenant>;

      @Attribute(DataTypes.STRING)
      declare tenantSlug: string | null;

      @BelongsTo(() => Tenant, { foreignKey: 'tenantSlug', targetKey: 'slug' })
      declare tenantBySlug?: NonAttribute<Tenant>;
    }

    sequelize.addModels([Tenant, Document]);
    await Tenant.sync({ force: true });
    await Document.sync({ force: true });

    await Tenant.create({ id: 1, name: 'Acme' });
    await Document.create({ externalTenantId: 1001, tenantSlug: 'acme' });

    const document = await Document.findOne({
      include: ['tenant', 'tenantBySlug'],
      rejectOnEmpty: true,
    });
    expect(document.tenant?.id).to.equal(1);
    expect(document.tenantBySlug?.id).to.equal(1);

    const tenant = await Tenant.findByPk(1, { include: ['documents'], rejectOnEmpty: true });
    expect(tenant.documents).to.have.length(1);

    await expect(Document.create({ externalTenantId: 1009, tenantSlug: null })).to.be.rejectedWith(
      ForeignKeyConstraintError,
    );
  });

  it('supports virtual generated columns', async function () {
    // virtual generated columns were added in PostgreSQL 18
    if (
      !virtual ||
      (dialect.name === 'postgres' && semver.lt(sequelize.getDatabaseVersion(), '18.0.0'))
    ) {
      this.skip();
    }

    const LineItem = await syncLineItem({
      generatedAs: {
        expression: sql`${sql.attribute('unitPrice')} * ${sql.attribute('quantity')}`,
        stored: false,
      },
    });

    const item = await LineItem.create({ unitPrice: 4, quantity: 2 });
    await item.reload();
    expect(item.total).to.equal(8);
  });

  if (dialect.name === 'sqlite3') {
    describe('sqlite3', () => {
      beforeEach(async () => {
        // SQLite keeps the expressions of generated columns only in the CREATE TABLE statement
        await sequelize.queryRaw(
          `CREATE TABLE "tricky" ("a, b" VARCHAR(255), [x)] INTEGER, "as (" TEXT GENERATED ALWAYS AS ('x), AS (' || "a, b" || [x)]) STORED, [e""] INTEGER /* AS (0), */ AS ((1 + ([x)])) * 3), "plain" TEXT)`,
        );
        await sequelize.queryRaw(`INSERT INTO "tricky" ("a, b", [x)]) VALUES ('a', 1)`);
      });

      it('describeTable reads the expression of generated columns', async () => {
        const columns = await sequelize.queryInterface.describeTable('tricky');

        expect(columns['a, b'].generatedAs).to.be.undefined;
        expect(columns['as ('].generatedAs).to.deep.equal({
          expression: sql.literal(`'x), AS (' || "a, b" || [x)]`),
          stored: true,
        });
        expect(columns['e""'].generatedAs).to.deep.equal({
          expression: sql.literal('(1 + ([x)])) * 3'),
          stored: false,
        });
      });

      it('keeps generated columns when the table is rebuilt', async () => {
        await sequelize.queryInterface.changeColumn('tricky', 'x)', {
          type: DataTypes.INTEGER,
          allowNull: false,
        });
        await sequelize.queryInterface.renameColumn('tricky', 'plain', 'renamed');

        const [rows] = await sequelize.queryRaw(`SELECT * FROM "tricky"`);
        expect(rows).to.deep.equal([
          { 'a, b': 'a', 'x)': 1, 'as (': 'x), AS (a1', 'e""': 6, renamed: null },
        ]);
      });
    });
  }
});
