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

async function defineModels({ dependsOn = true, locationTable = 'dep_locations' } = {}) {
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

  @Table({ modelName: `DepLocation${suffix}`, tableName: locationTable, timestamps: false })
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

// the triggers of the functions that maintain the generated columns of a table
async function countTriggers(table = 'dep_locations'): Promise<number> {
  const [{ count }] = await sequelize.query<{ count: string }>(
    `SELECT count(*) FROM pg_trigger JOIN pg_description ON objoid = tgfoid AND classoid = 'pg_proc'::regclass
      WHERE description = :description`,
    {
      type: QueryTypes.SELECT,
      replacements: { description: `sequelize generated columns of "${table}"` },
    },
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

      // a row whose primary key changes has no old row to compare with
      await sequelize.query(
        'UPDATE dep_links SET id = id + 100, "locationId" = :locationId WHERE "customerId" = :customerId',
        { replacements: { locationId: locations[1].id, customerId: second.id } },
      );
      const renumbered = await Location.findAll({ order: ['id'] });
      expect(renumbered.map(row => row.fuelCustomerId)).to.deep.equal([first.id, second.id]);
    });

    it('leaves the rows alone when an update does not change the columns it reads', async () => {
      const { Customer, Link, Location } = await defineModels();
      await Customer.sync({ force: true });
      await Location.sync({ force: true });
      await Link.sync({ force: true });

      const customer = await Customer.create({ name: 'owner' });
      const location = await Location.create({ address: 'a' });
      await Link.create({ customerId: customer.id, locationId: location.id, type: 'owner' });

      // runs a statement in a transaction that stays open while another connection locks the location
      async function lockAfter(statement: string) {
        const transaction = await sequelize.startUnmanagedTransaction();
        try {
          await sequelize.query(statement, { transaction });
          await sequelize.query('SELECT FROM dep_locations FOR UPDATE NOWAIT');
        } finally {
          await transaction.rollback();
        }
      }

      // the expression reads the id and deletedAt of customers, not their name
      await lockAfter(`UPDATE dep_customers SET name = 'renamed'`);
      await lockAfter('UPDATE dep_links SET type = type');
      await expect(lockAfter('UPDATE dep_customers SET "deletedAt" = now()')).to.be.rejectedWith(
        'could not obtain lock',
      );
    });

    it('computes each row once', async () => {
      const { Customer } = await defineModels();
      await Customer.sync({ force: true });
      await sequelize.query(`CREATE SEQUENCE dep_runs;
        CREATE FUNCTION dep_counted(value text) RETURNS text LANGUAGE sql AS $$ SELECT nextval('dep_runs'); SELECT value $$;`);

      // the number of times the expression ran since the last call
      async function runs(): Promise<number> {
        const [{ count }] = await sequelize.query<{ count: string }>(
          'SELECT CASE WHEN is_called THEN last_value ELSE 0 END AS count FROM dep_runs',
          { type: QueryTypes.SELECT },
        );
        await sequelize.query(`SELECT setval('dep_runs', 1, false)`);

        return Number(count);
      }

      @Table({
        modelName: `DepInvoice${modelCount++}`,
        tableName: 'dep_invoices',
        timestamps: false,
      })
      class Invoice extends Model<InferAttributes<Invoice>, InferCreationAttributes<Invoice>> {
        declare id: CreationOptional<number>;

        @Attribute(DataTypes.INTEGER)
        declare customerId: number;

        @Attribute(DataTypes.STRING)
        declare note: string | null;

        @Attribute(DataTypes.STRING)
        @GeneratedAs({
          expression: sql`dep_counted((SELECT customer.name FROM dep_customers AS customer WHERE customer.id = ${sql.attribute('customerId')}))`,
          dependsOn: ['customer'],
        })
        declare customerName: CreationOptional<string | null>;

        @BelongsTo(() => Customer, { foreignKey: 'customerId', foreignKeyConstraints: false })
        declare customer?: NonAttribute<InstanceType<typeof Customer>>;
      }

      sequelize.addModels([Invoice]);

      try {
        const [owner, tenant] = await Customer.bulkCreate([{ name: 'owner' }, { name: 'tenant' }]);
        // a row that exists before the triggers
        await sequelize.queryInterface.createTable('dep_invoices', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          customerId: DataTypes.INTEGER,
          note: DataTypes.STRING,
          customerName: DataTypes.STRING,
        });
        await sequelize.query('INSERT INTO dep_invoices ("customerId") VALUES (:id)', {
          replacements: { id: owner.id },
        });
        await runs();

        await sequelize.queryInterface.syncGeneratedColumnTriggers(Invoice);
        expect(await runs()).to.equal(1);
        const invoice = await Invoice.findOne({ rejectOnEmpty: true });
        expect(invoice.customerName).to.equal('owner');

        await Invoice.create({ customerId: tenant.id });
        expect(await runs()).to.equal(1);

        // the refresh does not run the trigger of the row again
        await owner.update({ name: 'renamed' });
        expect(await runs()).to.equal(1);
        await invoice.reload();
        expect(invoice.customerName).to.equal('renamed');

        // columns it does not read
        await sequelize.query('UPDATE dep_customers SET "updatedAt" = now()');
        await invoice.update({ note: 'paid' });
        expect(await runs()).to.equal(0);

        await invoice.update({ customerId: tenant.id });
        expect(await runs()).to.equal(1);
        expect(invoice.customerName).to.equal('tenant');

        // a direct write is computed again
        await sequelize.query(`UPDATE dep_invoices SET "customerName" = 'forged'`);
        expect(await runs()).to.equal(2);
        await invoice.reload();
        expect(invoice.customerName).to.equal('tenant');
      } finally {
        await Invoice.drop();
        await sequelize.query('DROP FUNCTION dep_counted(text); DROP SEQUENCE dep_runs;');
      }
    });

    it('refreshes on every update when Postgres cannot tell the columns it reads', async () => {
      const { Customer } = await defineModels();
      await Customer.sync({ force: true });

      @Table({ modelName: `DepNote${modelCount++}`, tableName: 'dep_notes', timestamps: false })
      class Note extends Model<InferAttributes<Note>, InferCreationAttributes<Note>> {
        declare id: CreationOptional<number>;

        @Attribute(DataTypes.INTEGER)
        declare customerId: number;

        // reads the customer whole-row
        @Attribute(DataTypes.STRING)
        @GeneratedAs({
          expression: sql`(SELECT row_to_json(customer)->>'name' FROM dep_customers AS customer WHERE customer.id = ${sql.attribute('customerId')})`,
          dependsOn: ['customer'],
        })
        declare customerName: CreationOptional<string | null>;

        @BelongsTo(() => Customer, { foreignKey: 'customerId', foreignKeyConstraints: false })
        declare customer?: NonAttribute<InstanceType<typeof Customer>>;
      }

      sequelize.addModels([Note]);
      await Note.sync({ force: true });
      // no guard, as the trigger of the row runs on every update
      expect(await countTriggers('dep_notes')).to.equal(4);

      const customer = await Customer.create({ name: 'owner' });
      const note = await Note.create({ customerId: customer.id });
      await customer.update({ name: 'renamed' });
      await note.reload();
      expect(note.customerName).to.equal('renamed');
      await Note.drop();
    });

    it('lets sync alter a table whose trigger runs on update of the columns the expression reads', async () => {
      const { Customer } = await defineModels();
      await Customer.sync({ force: true });

      @Table({ modelName: `DepNote${modelCount++}`, tableName: 'dep_notes', timestamps: false })
      class Note extends Model<InferAttributes<Note>, InferCreationAttributes<Note>> {
        declare id: CreationOptional<number>;

        @Attribute(DataTypes.INTEGER)
        declare customerId: number;

        @Attribute(DataTypes.STRING)
        @GeneratedAs({
          expression: sql`(SELECT customer.name FROM dep_customers AS customer WHERE customer.id = ${sql.attribute('customerId')})`,
          dependsOn: ['customer'],
        })
        declare customerName: CreationOptional<string | null>;

        @BelongsTo(() => Customer, { foreignKey: 'customerId', foreignKeyConstraints: false })
        declare customer?: NonAttribute<InstanceType<typeof Customer>>;
      }

      sequelize.addModels([Note]);
      await Note.sync({ force: true });
      // Postgres refuses to alter the type of "customerId" while a trigger runs on UPDATE OF it
      await Note.sync({ alter: true });

      const customer = await Customer.create({ name: 'owner' });
      const note = await Note.create({ customerId: customer.id });
      await customer.update({ name: 'renamed' });
      await note.reload();
      expect(note.customerName).to.equal('renamed');
      await Note.drop();
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

      // own trigger and its guard, and an insert, update and delete trigger on each of the 2 tables read
      expect(await countTriggers()).to.equal(8);

      // syncing again replaces them
      await Location.sync();
      expect(await countTriggers()).to.equal(8);
    });

    it('drops the triggers once the attribute no longer depends on other tables', async () => {
      const { Customer, Link, Location } = await defineModels();
      await Customer.sync({ force: true });
      await Location.sync({ force: true });
      await Link.sync({ force: true });
      expect(await countTriggers()).to.equal(8);

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

    it('drops the triggers of a table dropped without its model', async () => {
      const { Customer, Link, Location } = await defineModels();
      await Customer.sync({ force: true });
      await Location.sync({ force: true });
      await Link.sync({ force: true });
      await Customer.create({ name: 'owner' });

      // a migration drops the table while its model is not loaded, and other models use dependsOn
      sequelize.removeAllModels();
      await defineModels({ locationTable: 'dep_other_locations' });
      await sequelize.queryInterface.dropTable('dep_locations', { cascade: true });
      expect(await countTriggers()).to.equal(0);
      await sequelize.query(`UPDATE dep_customers SET name = 'renamed'`);
    });

    it('leaves alone the functions of a table of the same name in another schema', async () => {
      const { Customer, Link, Location } = await defineModels();
      await Customer.sync({ force: true });
      await Location.sync({ force: true });
      await Link.sync({ force: true });
      await sequelize.query(`DROP SCHEMA IF EXISTS dep_other CASCADE; CREATE SCHEMA dep_other;
        CREATE FUNCTION dep_other.maintain() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
        COMMENT ON FUNCTION dep_other.maintain() IS 'sequelize generated columns of "dep_locations"';`);

      try {
        await Location.sync();
        expect(await countTriggers()).to.equal(8);
        const [{ exists }] = await sequelize.query<{ exists: boolean }>(
          `SELECT to_regprocedure('dep_other.maintain()') IS NOT NULL AS exists`,
          { type: QueryTypes.SELECT },
        );
        expect(exists).to.equal(true);
      } finally {
        await sequelize.query('DROP SCHEMA dep_other CASCADE');
      }
    });

    it('lets concurrent syncs of the same table take turns', async () => {
      const { Customer, Link, Location } = await defineModels();
      await Customer.sync({ force: true });
      await Location.sync({ force: true });
      await Link.sync({ force: true });

      await Promise.all([
        sequelize.queryInterface.syncGeneratedColumnTriggers(Location),
        sequelize.queryInterface.syncGeneratedColumnTriggers(Location),
      ]);
      expect(await countTriggers()).to.equal(8);
    });

    it('names the triggers of a table with a non-ASCII name within the identifier limit', async () => {
      const locationTable = '位置'.repeat(10);
      const { Customer, Link, Location } = await defineModels({ locationTable });
      await Customer.sync({ force: true });
      await Location.sync({ force: true });
      await Link.sync({ force: true });

      expect(await countTriggers(locationTable)).to.equal(8);
      await Link.drop();
      await Location.drop();
    });

    it('refreshes each association to the same table', async () => {
      const { Customer } = await defineModels();
      await Customer.sync({ force: true });

      @Table({ modelName: `DepOrder${modelCount++}`, tableName: 'dep_orders', timestamps: false })
      class Order extends Model<InferAttributes<Order>, InferCreationAttributes<Order>> {
        declare id: CreationOptional<number>;

        @Attribute(DataTypes.INTEGER)
        declare billingCustomerId: number;

        @Attribute(DataTypes.INTEGER)
        declare shippingCustomerId: number;

        @Attribute(DataTypes.JSON)
        @GeneratedAs({
          expression: sql`(SELECT json_build_array(billing.name, shipping.name) FROM dep_customers AS billing, dep_customers AS shipping
            WHERE billing.id = ${sql.attribute('billingCustomerId')} AND shipping.id = ${sql.attribute('shippingCustomerId')})`,
          dependsOn: ['billingCustomer', 'shippingCustomer'],
        })
        declare names: CreationOptional<string[] | null>;

        @BelongsTo(() => Customer, {
          foreignKey: 'billingCustomerId',
          foreignKeyConstraints: false,
        })
        declare billingCustomer?: NonAttribute<InstanceType<typeof Customer>>;

        @BelongsTo(() => Customer, {
          foreignKey: 'shippingCustomerId',
          foreignKeyConstraints: false,
        })
        declare shippingCustomer?: NonAttribute<InstanceType<typeof Customer>>;
      }

      sequelize.addModels([Order]);
      // a json column has no equality operator, which the refresh of the existing rows needs
      await Order.sync({ force: true });

      const [billing, shipping] = await Customer.bulkCreate([
        { name: 'billing' },
        { name: 'shipping' },
      ]);
      const order = await Order.create({
        billingCustomerId: billing.id,
        shippingCustomerId: shipping.id,
      });
      expect(order.names).to.deep.equal(['billing', 'shipping']);

      await billing.update({ name: 'billed' });
      await shipping.update({ name: 'shipped' });
      await order.reload();
      expect(order.names).to.deep.equal(['billed', 'shipped']);
      await Order.drop();
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
