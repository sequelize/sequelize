import type { CreationOptional, InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model, sql } from '@sequelize/core';
import { Attribute, ColumnName, Generated, Table } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import { beforeAll2, sequelize, setResetMode } from '../support';

const dialect = sequelize.dialect;

/**
 * Quote a column identifier for the current dialect's SQL.
 *
 * @param col The column identifier to quote.
 */
function qi(col: string): string {
  if (dialect.name === 'mssql') {
    return `[${col}]`;
  }

  if (dialect.name === 'mysql' || dialect.name === 'mariadb') {
    return `\`${col}\``;
  }

  return `"${col}"`;
}

/**
 * Build a string concatenation SQL expression.
 *
 * @param parts The SQL fragments to concatenate.
 */
function concatSql(...parts: string[]): string {
  if (dialect.name === 'mysql' || dialect.name === 'mariadb') {
    return `CONCAT(${parts.join(', ')})`;
  }

  if (dialect.name === 'mssql') {
    return parts.join(' + ');
  }

  return parts.join(' || ');
}

if (!dialect.supports.generatedColumns.stored && !dialect.supports.generatedColumns.virtual) {
  describe('Generated Columns (integration)', () => {
    it('is not supported by this dialect', () => {
      expect(dialect.supports.generatedColumns.stored).to.equal(false);
      expect(dialect.supports.generatedColumns.virtual).to.equal(false);
    });
  });
} else {
  describe('Generated Columns (integration)', () => {
    if (dialect.name === 'sqlite3') {
      it('converges generated expression drift with sync({ alter: true })', async () => {
        const GeneratedSync = sequelize.define(
          'GeneratedSyncAlter',
          {
            source: DataTypes.INTEGER,
            computed: {
              type: DataTypes.INTEGER,
              generatedAs: sql.literal(`${qi('source')} + 1`),
              generatedColumn: 'STORED',
            },
          },
          { timestamps: false },
        );

        await GeneratedSync.sync({ force: true });
        const row = await GeneratedSync.create({ source: 2 });

        GeneratedSync.modelDefinition.rawAttributes.computed.generatedAs = sql.literal(
          `${qi('source')} + 2`,
        );
        GeneratedSync.modelDefinition.refreshAttributes();
        await GeneratedSync.sync({ alter: true });

        const refreshed = await GeneratedSync.findByPk(row.id);
        expect(refreshed?.get('computed')).to.equal(4);

        delete GeneratedSync.modelDefinition.rawAttributes.computed.generatedAs;
        delete GeneratedSync.modelDefinition.rawAttributes.computed.generatedColumn;
        GeneratedSync.modelDefinition.refreshAttributes();
        await GeneratedSync.sync({ alter: true });

        const columns = await sequelize.queryInterface.describeTable(GeneratedSync.table);
        expect(columns.computed.generatedAs).to.equal(undefined);

        await GeneratedSync.drop();
      });
    }

    if (dialect.supports.generatedColumns.stored) {
      describe('STORED generated columns', () => {
        setResetMode('destroy');

        const vars = beforeAll2(async () => {
          // String concatenation generated column
          class UserConcat extends Model<
            InferAttributes<UserConcat>,
            InferCreationAttributes<UserConcat>
          > {
            declare id: CreationOptional<number>;

            @Attribute(DataTypes.STRING)
            declare firstName: string;

            @Attribute(DataTypes.STRING)
            declare lastName: string;

            @Attribute({
              type: DataTypes.STRING,
              generatedAs: sql.literal(concatSql(qi('firstName'), "' '", qi('lastName'))),
              generatedColumn: 'STORED',
            })
            declare fullName: string | null;
          }

          // Numeric arithmetic generated column
          class OrderItem extends Model<
            InferAttributes<OrderItem>,
            InferCreationAttributes<OrderItem>
          > {
            declare id: CreationOptional<number>;

            @Attribute(DataTypes.INTEGER)
            declare price: number;

            @Attribute(DataTypes.INTEGER)
            declare quantity: number;

            @Attribute({
              type: DataTypes.INTEGER,
              generatedAs: sql.literal(`${qi('price')} * ${qi('quantity')}`),
              generatedColumn: 'STORED',
            })
            declare total: number | null;
          }

          sequelize.addModels([UserConcat, OrderItem]);
          await sequelize.sync({ force: true });

          return { UserConcat, OrderItem };
        });

        describe('data parity', () => {
          it('computes string concatenation on create', async () => {
            const { UserConcat } = vars;
            const user = await UserConcat.create({ firstName: 'John', lastName: 'Doe' });

            // Re-fetch from DB to get the generated value
            const fetched = await UserConcat.findByPk(user.id);
            expect(fetched).to.not.be.null;
            expect(fetched!.fullName).to.equal('John Doe');
          });

          it('computes numeric arithmetic on create', async () => {
            const { OrderItem } = vars;
            const item = await OrderItem.create({ price: 25, quantity: 4 });

            const fetched = await OrderItem.findByPk(item.id);
            expect(fetched).to.not.be.null;
            expect(fetched!.total).to.equal(100);
          });

          it('recomputes generated column when source columns are updated', async () => {
            const { UserConcat } = vars;
            const user = await UserConcat.create({ firstName: 'Jane', lastName: 'Smith' });

            await UserConcat.update({ firstName: 'Janet' }, { where: { id: user.id } });

            const fetched = await UserConcat.findByPk(user.id);
            expect(fetched).to.not.be.null;
            expect(fetched!.fullName).to.equal('Janet Smith');
          });

          it('handles NULL source columns correctly', async () => {
            // Define a model that allows null source columns
            class NullableSource extends Model<
              InferAttributes<NullableSource>,
              InferCreationAttributes<NullableSource>
            > {
              declare id: CreationOptional<number>;

              @Attribute({ type: DataTypes.STRING, allowNull: true })
              declare firstName: string | null;

              @Attribute({ type: DataTypes.STRING, allowNull: true })
              declare lastName: string | null;

              @Attribute({
                type: DataTypes.STRING,
                generatedAs: sql.literal(concatSql(qi('firstName'), "' '", qi('lastName'))),
                generatedColumn: 'STORED',
              })
              declare fullName: string | null;
            }

            sequelize.addModels([NullableSource]);
            await NullableSource.sync({ force: true });

            const record = await NullableSource.create({ firstName: null, lastName: 'Smith' });
            const fetched = await NullableSource.findByPk(record.id);
            expect(fetched).to.not.be.null;
            // NULL || anything = NULL in SQL (except MSSQL which uses + concatenation)
            expect(fetched!.fullName).to.be.null;
          });

          it('computes with multiple data value combinations', async () => {
            const { OrderItem } = vars;

            await OrderItem.bulkCreate([
              { price: 10, quantity: 1 },
              { price: 5, quantity: 10 },
              { price: 0, quantity: 100 },
              { price: 99, quantity: 3 },
            ]);

            const items = await OrderItem.findAll({ order: [['price', 'ASC']] });
            expect(items).to.have.lengthOf(4);
            expect(items[0].total).to.equal(0); // 0 * 100
            expect(items[1].total).to.equal(50); // 5 * 10
            expect(items[2].total).to.equal(10); // 10 * 1
            expect(items[3].total).to.equal(297); // 99 * 3
          });
        });

        describe('query support', () => {
          it('supports WHERE clause on generated columns', async () => {
            const { UserConcat } = vars;

            await UserConcat.bulkCreate([
              { firstName: 'Alice', lastName: 'Anderson' },
              { firstName: 'Bob', lastName: 'Brown' },
              { firstName: 'Charlie', lastName: 'Clark' },
            ]);

            const results = await UserConcat.findAll({
              where: { fullName: 'Bob Brown' },
            });

            expect(results).to.have.lengthOf(1);
            expect(results[0].firstName).to.equal('Bob');
          });

          it('supports ORDER BY on generated columns', async () => {
            const { OrderItem } = vars;

            await OrderItem.bulkCreate([
              { price: 5, quantity: 20 }, // total = 100
              { price: 10, quantity: 1 }, // total = 10
              { price: 3, quantity: 50 }, // total = 150
            ]);

            const items = await OrderItem.findAll({
              order: [['total', 'ASC']],
            });

            expect(items).to.have.lengthOf(3);
            expect(items[0].total).to.equal(10);
            expect(items[1].total).to.equal(100);
            expect(items[2].total).to.equal(150);
          });

          it('returns generated column values in findAll', async () => {
            const { UserConcat } = vars;

            await UserConcat.create({ firstName: 'Test', lastName: 'User' });
            const users = await UserConcat.findAll();
            expect(users).to.have.lengthOf(1);
            expect(users[0].fullName).to.equal('Test User');
          });

          it('returns generated column values in findOne', async () => {
            const { UserConcat } = vars;

            await UserConcat.create({ firstName: 'Single', lastName: 'Find' });
            const user = await UserConcat.findOne({ where: { firstName: 'Single' } });
            expect(user).to.not.be.null;
            expect(user!.fullName).to.equal('Single Find');
          });
        });

        describe('write path exclusion', () => {
          it('excludes generated columns from Model.create()', async () => {
            const { UserConcat } = vars;

            // The generated column should not appear in the INSERT statement.
            // If it does, the DB will reject it.
            const user = await UserConcat.create({ firstName: 'Insert', lastName: 'Test' });
            const fetched = await UserConcat.findByPk(user.id);
            expect(fetched!.fullName).to.equal('Insert Test');
          });

          it('excludes generated columns from Model.bulkCreate()', async () => {
            const { UserConcat } = vars;

            await UserConcat.bulkCreate([
              { firstName: 'Bulk', lastName: 'One' },
              { firstName: 'Bulk', lastName: 'Two' },
            ]);

            const fetched = await UserConcat.findAll({
              where: { firstName: 'Bulk' },
              order: [['lastName', 'ASC']],
            });

            expect(fetched).to.have.lengthOf(2);
            expect(fetched[0].fullName).to.equal('Bulk One');
            expect(fetched[1].fullName).to.equal('Bulk Two');
          });

          it('excludes generated columns from instance.save() on update', async () => {
            const { UserConcat } = vars;

            const user = await UserConcat.create({ firstName: 'Save', lastName: 'Initial' });
            const fetched = await UserConcat.findByPk(user.id);
            expect(fetched).to.not.be.null;

            fetched!.lastName = 'Updated';
            await fetched!.save();

            const reFetched = await UserConcat.findByPk(user.id);
            expect(reFetched!.fullName).to.equal('Save Updated');
          });

          if (dialect.supports.upserts) {
            it('excludes generated columns from Model.upsert()', async () => {
              const { UserConcat } = vars;

              const user = await UserConcat.create({ firstName: 'Upsert', lastName: 'Original' });

              // Upsert with the same PK should update
              await UserConcat.upsert({
                id: user.id,
                firstName: 'Upsert',
                lastName: 'Modified',
              });

              const fetched = await UserConcat.findByPk(user.id);
              expect(fetched).to.not.be.null;
              expect(fetched!.fullName).to.equal('Upsert Modified');
            });
          }

          it('throws error when trying to increment a generated column', async () => {
            const { OrderItem } = vars;

            const item = await OrderItem.create({ price: 10, quantity: 5 });

            await expect(OrderItem.increment('total', { by: 1, where: { id: item.id } })).to.be
              .rejected;
          });

          it('throws error when trying to decrement a generated column', async () => {
            const { OrderItem } = vars;

            const item = await OrderItem.create({ price: 10, quantity: 5 });

            await expect(OrderItem.decrement('total', { by: 1, where: { id: item.id } })).to.be
              .rejected;
          });

          it('ignores set() on generated columns for persisted (non-new) records', async () => {
            const { UserConcat } = vars;

            const user = await UserConcat.create({ firstName: 'Block', lastName: 'Set' });
            const fetched = await UserConcat.findByPk(user.id);
            expect(fetched).to.not.be.null;

            // readOnly attributes are silently ignored by set()
            fetched!.set('fullName', 'Manual Override');
            // The value should remain unchanged — the generated column is read-only
            expect(fetched!.fullName).to.equal('Block Set');
          });

          it('ignores generated attributes in Model.update()', async () => {
            const { UserConcat } = vars;
            const user = await UserConcat.create({ firstName: 'Static', lastName: 'Update' });

            const [affectedRows] = await UserConcat.update(
              { fullName: 'Manual Override' },
              { where: { id: user.id } },
            );

            expect(affectedRows).to.equal(0);
            const fetched = await UserConcat.findByPk(user.id);
            expect(fetched!.fullName).to.equal('Static Update');
          });
        });
      });
    }

    if (dialect.supports.generatedColumns?.virtual) {
      describe('VIRTUAL generated columns', () => {
        setResetMode('destroy');

        const vars = beforeAll2(async () => {
          class VirtualGenCol extends Model<
            InferAttributes<VirtualGenCol>,
            InferCreationAttributes<VirtualGenCol>
          > {
            declare id: CreationOptional<number>;

            @Attribute(DataTypes.INTEGER)
            declare price: number;

            @Attribute(DataTypes.INTEGER)
            declare quantity: number;

            @Attribute({
              type: DataTypes.INTEGER,
              generatedAs: sql.literal(`${qi('price')} * ${qi('quantity')}`),
              generatedColumn: 'VIRTUAL',
            })
            declare total: number | null;
          }

          sequelize.addModels([VirtualGenCol]);
          await sequelize.sync({ force: true });

          return { VirtualGenCol };
        });

        it('computes values for VIRTUAL generated columns', async () => {
          const { VirtualGenCol } = vars;

          const item = await VirtualGenCol.create({ price: 15, quantity: 3 });
          const fetched = await VirtualGenCol.findByPk(item.id);
          expect(fetched).to.not.be.null;
          expect(fetched!.total).to.equal(45);
        });

        it('recomputes VIRTUAL generated column on source update', async () => {
          const { VirtualGenCol } = vars;

          const item = await VirtualGenCol.create({ price: 10, quantity: 2 });
          await VirtualGenCol.update({ quantity: 5 }, { where: { id: item.id } });

          const fetched = await VirtualGenCol.findByPk(item.id);
          expect(fetched).to.not.be.null;
          expect(fetched!.total).to.equal(50);
        });

        it('excludes VIRTUAL generated columns from INSERT', async () => {
          const { VirtualGenCol } = vars;

          // This should succeed — the generated column must not be in the INSERT
          const item = await VirtualGenCol.create({ price: 7, quantity: 8 });
          const fetched = await VirtualGenCol.findByPk(item.id);
          expect(fetched!.total).to.equal(56);
        });

        it('excludes VIRTUAL generated columns from UPDATE', async () => {
          const { VirtualGenCol } = vars;

          const item = await VirtualGenCol.create({ price: 12, quantity: 3 });
          const fetched = await VirtualGenCol.findByPk(item.id);
          fetched!.price = 20;
          await fetched!.save();

          const reFetched = await VirtualGenCol.findByPk(item.id);
          expect(reFetched!.total).to.equal(60);
        });

        it('supports WHERE on VIRTUAL generated columns', async () => {
          const { VirtualGenCol } = vars;

          await VirtualGenCol.bulkCreate([
            { price: 10, quantity: 1 }, // total = 10
            { price: 5, quantity: 10 }, // total = 50
            { price: 20, quantity: 3 }, // total = 60
          ]);

          const results = await VirtualGenCol.findAll({
            where: { total: 50 },
          });

          expect(results).to.have.lengthOf(1);
          expect(results[0].price).to.equal(5);
          expect(results[0].quantity).to.equal(10);
        });
      });
    }

    if (dialect.supports.generatedColumns.stored) {
      describe('migration support', () => {
        // DB2 and IBMi do not support ALTER TABLE ADD COLUMN with a generated expression
        if (dialect.name === 'db2' || dialect.name === 'ibmi') {
          return;
        }

        it('supports addColumn with a STORED generated column', async () => {
          const queryInterface = sequelize.queryInterface;
          const queryGenerator = sequelize.dialect.queryGenerator;

          await queryInterface.createTable('migration_gen_test', {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
            price: {
              type: DataTypes.INTEGER,
              allowNull: false,
            },
            quantity: {
              type: DataTypes.INTEGER,
              allowNull: false,
            },
          });

          await queryInterface.addColumn('migration_gen_test', 'total', {
            type: DataTypes.INTEGER,
            generatedAs: sql.literal(`${qi('price')} * ${qi('quantity')}`),
            generatedColumn: 'STORED',
          });

          // Insert a row using raw query (since we don't have a Model for this)
          const tableName = queryGenerator.quoteIdentifier('migration_gen_test');
          const priceCol = queryGenerator.quoteIdentifier('price');
          const quantityCol = queryGenerator.quoteIdentifier('quantity');
          const totalCol = queryGenerator.quoteIdentifier('total');

          await sequelize.query(
            `INSERT INTO ${tableName} (${priceCol}, ${quantityCol}) VALUES (10, 5)`,
          );

          const [results] = await sequelize.query(`SELECT ${totalCol} FROM ${tableName}`);

          expect(results).to.have.lengthOf(1);
          expect((results[0] as any).total).to.equal(50);

          await queryInterface.dropTable('migration_gen_test');
        });
      });

      describe('decorator API', () => {
        setResetMode('destroy');

        it('works with the generated column decorator', async () => {
          class DecoratorModel extends Model<
            InferAttributes<DecoratorModel>,
            InferCreationAttributes<DecoratorModel>
          > {
            declare id: CreationOptional<number>;

            @ColumnName('source_value')
            @Attribute(DataTypes.INTEGER)
            declare sourceValue: number;

            @Attribute(DataTypes.INTEGER)
            @Generated(sql.fn('abs', sql.attribute('sourceValue')))
            declare absoluteValue: number | null;
          }

          sequelize.addModels([DecoratorModel]);
          await sequelize.sync({ force: true });

          const record = await DecoratorModel.create({ sourceValue: -7 });
          const fetched = await DecoratorModel.findByPk(record.id);
          expect(fetched).to.not.be.null;
          expect(fetched!.absoluteValue).to.equal(7);
        });
      });

      describe('edge cases', () => {
        setResetMode('destroy');

        it('supports multiple generated columns on the same model', async () => {
          class MultiGen extends Model<
            InferAttributes<MultiGen>,
            InferCreationAttributes<MultiGen>
          > {
            declare id: CreationOptional<number>;

            @Attribute(DataTypes.INTEGER)
            declare a: number;

            @Attribute(DataTypes.INTEGER)
            declare b: number;

            @Attribute({
              type: DataTypes.INTEGER,
              generatedAs: sql.literal(`${qi('a')} + ${qi('b')}`),
              generatedColumn: 'STORED',
            })
            declare sum: number | null;

            @Attribute({
              type: DataTypes.INTEGER,
              generatedAs: sql.literal(`${qi('a')} * ${qi('b')}`),
              generatedColumn: 'STORED',
            })
            declare product: number | null;
          }

          sequelize.addModels([MultiGen]);
          await sequelize.sync({ force: true });

          const record = await MultiGen.create({ a: 6, b: 4 });
          const fetched = await MultiGen.findByPk(record.id);
          expect(fetched).to.not.be.null;
          expect(fetched!.sum).to.equal(10);
          expect(fetched!.product).to.equal(24);
        });

        it('generated columns work alongside timestamps', async () => {
          class WithTimestamps extends Model<
            InferAttributes<WithTimestamps>,
            InferCreationAttributes<WithTimestamps>
          > {
            declare id: CreationOptional<number>;
            declare createdAt: CreationOptional<Date>;
            declare updatedAt: CreationOptional<Date>;

            @Attribute(DataTypes.INTEGER)
            declare value: number;

            @Attribute({
              type: DataTypes.INTEGER,
              generatedAs: sql.literal(`${qi('value')} * 2`),
              generatedColumn: 'STORED',
            })
            declare doubled: number | null;
          }

          sequelize.addModels([WithTimestamps]);
          await sequelize.sync({ force: true });

          const record = await WithTimestamps.create({ value: 21 });
          const fetched = await WithTimestamps.findByPk(record.id);
          expect(fetched).to.not.be.null;
          expect(fetched!.doubled).to.equal(42);
          expect(fetched!.createdAt).to.be.an.instanceOf(Date);
          expect(fetched!.updatedAt).to.be.an.instanceOf(Date);
        });

        it('works with underscored: true (column names differ from attribute names)', async () => {
          @Table({ underscored: true })
          class UnderscoredGen extends Model<
            InferAttributes<UnderscoredGen>,
            InferCreationAttributes<UnderscoredGen>
          > {
            declare id: CreationOptional<number>;

            @Attribute(DataTypes.INTEGER)
            declare basePrice: number;

            @Attribute(DataTypes.INTEGER)
            declare taxRate: number;

            @Attribute({
              type: DataTypes.INTEGER,
              // Column names are underscored: base_price, tax_rate
              generatedAs: sql.literal(`${qi('base_price')} * ${qi('tax_rate')}`),
              generatedColumn: 'STORED',
            })
            declare totalCost: number | null;
          }

          sequelize.addModels([UnderscoredGen]);
          await UnderscoredGen.sync({ force: true });

          // Test create
          const record = await UnderscoredGen.create({ basePrice: 100, taxRate: 2 });
          const fetched = await UnderscoredGen.findByPk(record.id);
          expect(fetched).to.not.be.null;
          expect(fetched!.totalCost).to.equal(200);

          // Test bulkCreate
          await UnderscoredGen.bulkCreate([
            { basePrice: 50, taxRate: 3 },
            { basePrice: 10, taxRate: 5 },
          ]);
          const all = await UnderscoredGen.findAll({ order: [['basePrice', 'ASC']] });
          expect(all).to.have.lengthOf(3);
          expect(all[0].totalCost).to.equal(50); // 10 * 5
          expect(all[1].totalCost).to.equal(150); // 50 * 3

          // Test upsert (if supported)
          if (dialect.supports.upserts) {
            await UnderscoredGen.upsert({
              id: record.id,
              basePrice: 200,
              taxRate: 3,
            });
            const upserted = await UnderscoredGen.findByPk(record.id);
            expect(upserted!.totalCost).to.equal(600);
          }
        });

        it('re-read after bulkCreate returns correct generated values', async () => {
          class BulkGenTest extends Model<
            InferAttributes<BulkGenTest>,
            InferCreationAttributes<BulkGenTest>
          > {
            declare id: CreationOptional<number>;

            @Attribute(DataTypes.INTEGER)
            declare x: number;

            @Attribute({
              type: DataTypes.INTEGER,
              generatedAs: sql.literal(`${qi('x')} * ${qi('x')}`),
              generatedColumn: 'STORED',
            })
            declare xSquared: number | null;
          }

          sequelize.addModels([BulkGenTest]);
          await sequelize.sync({ force: true });

          await BulkGenTest.bulkCreate([{ x: 2 }, { x: 3 }, { x: 5 }, { x: 7 }]);

          const results = await BulkGenTest.findAll({ order: [['x', 'ASC']] });
          expect(results).to.have.lengthOf(4);
          expect(results[0].xSquared).to.equal(4);
          expect(results[1].xSquared).to.equal(9);
          expect(results[2].xSquared).to.equal(25);
          expect(results[3].xSquared).to.equal(49);
        });
      });
    }
  });
}
