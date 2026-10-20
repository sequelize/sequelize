import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from '@sequelize/core';
import { DataTypes, Model, QueryTypes, sql } from '@sequelize/core';
import {
  Attribute,
  AutoIncrement,
  BelongsTo,
  BelongsToMany,
  GeneratedAs,
  NotNull,
  PrimaryKey,
  Table,
} from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import { sequelize } from '../support';

const dialect = sequelize.dialect;

let modelCount = 0;

// the newest active link of the first type in the chain whose customer is not deleted
const fuelCustomerExpression = sql`(
  SELECT link."customerId" FROM dep_links AS link
    JOIN dep_customers AS customer ON customer.id = link."customerId" AND customer."deletedAt" IS NULL
   WHERE link."locationId" = ${sql.attribute('id')} AND link."endAt" IS NULL AND link.type IN ('fuel', 'tenant', 'owner')
   ORDER BY array_position(ARRAY['fuel', 'tenant', 'owner']::varchar[], link.type), link.id DESC
   LIMIT 1
)`;

async function defineModels({ dependsOn = true } = {}) {
  const suffix = modelCount++;

  @Table({ modelName: `DepCustomer${suffix}`, tableName: 'dep_customers', paranoid: true })
  class Customer extends Model<InferAttributes<Customer>, InferCreationAttributes<Customer>> {
    declare id: CreationOptional<number>;

    @Attribute(DataTypes.STRING)
    @NotNull
    declare name: string;
  }

  @Table({ modelName: `DepLink${suffix}`, tableName: 'dep_links', timestamps: false })
  class Link extends Model<InferAttributes<Link>, InferCreationAttributes<Link>> {
    @Attribute(DataTypes.INTEGER)
    @PrimaryKey
    @AutoIncrement
    declare id: CreationOptional<number>;

    @Attribute(DataTypes.INTEGER)
    @NotNull
    declare customerId: number;

    @Attribute(DataTypes.INTEGER)
    @NotNull
    declare locationId: number;

    @Attribute(DataTypes.STRING)
    @NotNull
    declare type: string;

    @Attribute(DataTypes.DATE)
    declare endAt: Date | null;
  }

  @Table({ modelName: `DepLocation${suffix}`, tableName: 'dep_locations', timestamps: false })
  class Location extends Model<InferAttributes<Location>, InferCreationAttributes<Location>> {
    declare id: CreationOptional<number>;

    @Attribute(DataTypes.STRING)
    declare address: string | null;

    @Attribute(DataTypes.INTEGER)
    @GeneratedAs(
      dependsOn
        ? { expression: fuelCustomerExpression, dependsOn: ['customers'] }
        : sql`NULL::integer`,
    )
    declare fuelCustomerId: CreationOptional<number | null>;

    @BelongsTo(() => Customer, { foreignKey: 'fuelCustomerId', foreignKeyConstraints: false })
    declare fuelCustomer?: NonAttribute<Customer>;

    @BelongsToMany(() => Customer, {
      through: { model: () => Link, unique: false },
      foreignKey: 'locationId',
      otherKey: 'customerId',
      inverse: { as: `locations${suffix}` },
    })
    declare customers?: NonAttribute<Customer[]>;
  }

  sequelize.addModels([Customer, Link, Location]);

  return { Customer, Link, Location };
}

// the triggers of the functions that maintain the generated columns of dep_locations
async function countTriggers(): Promise<number> {
  const [{ count }] = await sequelize.query<{ count: string }>(
    `SELECT count(*) FROM pg_trigger JOIN pg_description ON objoid = tgfoid AND classoid = 'pg_proc'::regclass
      WHERE description = 'sequelize generated columns of "dep_locations"'`,
    { type: QueryTypes.SELECT },
  );

  return Number(count);
}

(dialect.supports.generatedColumns.dependsOn ? describe : describe.skip)(
  'Model generated columns that depend on other tables',
  () => {
    it('keeps the column up to date when the tables it reads change', async () => {
      const { Customer, Link, Location } = await defineModels();
      await Customer.sync({ force: true });
      await Location.sync({ force: true });
      await Link.sync({ force: true });

      const [owner, tenant, fuel] = await Customer.bulkCreate([
        { name: 'owner' },
        { name: 'tenant' },
        { name: 'fuel' },
      ]);
      const location = await Location.create({ address: '1 Main St' });
      expect(location.fuelCustomerId).to.equal(null);

      const fuelCustomerId = async () => (await Location.findByPk(location.id))!.fuelCustomerId;

      await Link.create({ customerId: owner.id, locationId: location.id, type: 'owner' });
      expect(await fuelCustomerId()).to.equal(owner.id);

      const tenantLink = await Link.create({
        customerId: tenant.id,
        locationId: location.id,
        type: 'tenant',
      });
      expect(await fuelCustomerId()).to.equal(tenant.id);

      const fuelLink = await Link.create({
        customerId: fuel.id,
        locationId: location.id,
        type: 'fuel',
      });
      expect(await fuelCustomerId()).to.equal(fuel.id);

      // ending a link falls back to the next type
      await fuelLink.update({ endAt: new Date() });
      expect(await fuelCustomerId()).to.equal(tenant.id);

      // soft-deleting and restoring a customer
      await tenant.destroy();
      expect(await fuelCustomerId()).to.equal(owner.id);
      await tenant.restore();
      expect(await fuelCustomerId()).to.equal(tenant.id);

      await tenantLink.destroy();
      expect(await fuelCustomerId()).to.equal(owner.id);

      // writing the row recomputes it, and the instance holds the result
      await location.update({ address: '2 Main St' });
      expect(location.fuelCustomerId).to.equal(owner.id);

      const withCustomer = await Location.findByPk(location.id, { include: ['fuelCustomer'] });
      expect(withCustomer!.fuelCustomer!.name).to.equal('owner');
    });

    it('refreshes every row changed by one statement', async () => {
      const { Customer, Link, Location } = await defineModels();
      await Customer.sync({ force: true });
      await Location.sync({ force: true });
      await Link.sync({ force: true });

      const [first, second] = await Customer.bulkCreate([{ name: 'first' }, { name: 'second' }]);
      const locations = await Location.bulkCreate([{ address: 'a' }, { address: 'b' }]);

      await Link.bulkCreate([
        { customerId: first.id, locationId: locations[0].id, type: 'owner' },
        { customerId: second.id, locationId: locations[1].id, type: 'fuel' },
      ]);

      const rows = await Location.findAll({ order: ['id'] });
      expect(rows.map(row => row.fuelCustomerId)).to.deep.equal([first.id, second.id]);

      // moving a link to another location refreshes both
      await Link.update({ locationId: locations[0].id }, { where: { customerId: second.id } });
      const moved = await Location.findAll({ order: ['id'] });
      expect(moved.map(row => row.fuelCustomerId)).to.deep.equal([second.id, null]);
    });

    it('creates the triggers when the tables it reads are created after the model', async () => {
      const { Customer, Link, Location } = await defineModels();
      // the link table does not exist when the location table syncs
      await Location.sync({ force: true });
      await Customer.sync({ force: true });
      await Link.sync({ force: true });

      const customer = await Customer.create({ name: 'owner' });
      const location = await Location.create({ address: 'a' });
      await Link.create({ customerId: customer.id, locationId: location.id, type: 'owner' });

      await location.reload();
      expect(location.fuelCustomerId).to.equal(customer.id);

      // own trigger, and an insert, update and delete trigger on each of the 2 tables read
      expect(await countTriggers()).to.equal(7);

      // syncing again replaces them
      await Location.sync();
      expect(await countTriggers()).to.equal(7);
    });

    it('drops the triggers once the attribute no longer depends on other tables', async () => {
      const { Customer, Link, Location } = await defineModels();
      await Customer.sync({ force: true });
      await Location.sync({ force: true });
      await Link.sync({ force: true });
      expect(await countTriggers()).to.equal(7);

      const { Location: PlainLocation } = await defineModels({ dependsOn: false });
      await sequelize.queryInterface.syncGeneratedColumnTriggers(PlainLocation);
      expect(await countTriggers()).to.equal(0);

      // the tables it read work without the triggers
      const customer = await Customer.create({ name: 'owner' });
      const location = await Location.create({ address: 'a' });
      await Link.create({ customerId: customer.id, locationId: location.id, type: 'owner' });
    });

    it('drops the triggers on the tables it reads when its table is dropped', async () => {
      const { Customer, Link, Location } = await defineModels();
      await Customer.sync({ force: true });
      await Location.sync({ force: true });
      await Link.sync({ force: true });

      await Link.drop();
      await Location.drop();
      expect(await countTriggers()).to.equal(0);

      // writes to the remaining table do not run a trigger that updates the dropped one
      await Customer.update({ name: 'renamed' }, { where: {} });
    });

    it('fills existing rows when a migration adds the column', async () => {
      const { Customer, Link, Location } = await defineModels();
      await Customer.sync({ force: true });
      await sequelize.queryInterface.createTable('dep_locations', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        address: DataTypes.STRING,
      });
      await Link.sync({ force: true });

      const customer = await Customer.create({ name: 'owner' });
      const [{ id: locationId }] = await sequelize.query<{ id: number }>(
        `INSERT INTO dep_locations (address) VALUES ('a') RETURNING id`,
        { type: QueryTypes.SELECT },
      );
      await Link.create({ customerId: customer.id, locationId, type: 'owner' });

      await sequelize.queryInterface.addColumn('dep_locations', 'fuelCustomerId', {
        type: DataTypes.INTEGER,
        generatedAs: { expression: fuelCustomerExpression, dependsOn: ['customers'] },
      });
      await sequelize.queryInterface.syncGeneratedColumnTriggers(Location);

      expect((await Location.findByPk(locationId))!.fuelCustomerId).to.equal(customer.id);
    });
  },
);
