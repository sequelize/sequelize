import { expect } from 'chai';
import { DataTypes, Op } from '@sequelize/core';
import { sequelize } from '../support';

const queryInterface = sequelize.queryInterface;
const dialect = sequelize.getDialect();

describe('QueryInterface#{add,show,removeConstraint}', () => {
  describe('Without schema', () => {
    const defaultSchema = dialect === 'db2' ? 'DB2INST1' : sequelize.dialect.getDefaultSchema();

    beforeEach(async () => {
      await queryInterface.createTable('levels', {
        id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        manager_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      });

      await queryInterface.createTable('actors', {
        id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        manager_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        status: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        age: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        level_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
      });
    });

    if (sequelize.dialect.supports.constraints.check) {
      it('should add, show, delete CHECK constraint', async () => {
        await queryInterface.addConstraint('actors', {
          name: 'custom_constraint_name',
          type: 'CHECK',
          fields: ['age'],
          where: {
            age: {
              [Op.gt]: 10,
            },
          },
        });

        const constraintType = await queryInterface.showConstraints('actors', { constraintType: 'CHECK' });
        if (dialect === 'postgres') {
          // Postgres adds a CHECK constraint for each column with not null
          expect(constraintType).to.have.length(6);
          expect(constraintType[5].constraintType).to.equal('CHECK');
        } else {
          expect(constraintType).to.have.length(1);
          expect(constraintType[0].constraintType).to.equal('CHECK');
        }

        const constraints = await queryInterface.showConstraints('actors', { constraintName: 'custom_constraint_name' });
        expect(constraints).to.have.length(1);

        const [check] = constraints;
        expect(check.constraintSchema).to.equal(defaultSchema);
        expect(check.constraintName).to.equal('custom_constraint_name');
        expect(check.constraintType).to.equal('CHECK');
        expect(check.tableName).to.equal('actors');
        expect(check.tableSchema).to.equal(defaultSchema);
        expect(check.definition).to.not.be.null;

        await queryInterface.removeConstraint('actors', 'custom_constraint_name');
        const constraintsAfterRemove = await queryInterface.showConstraints('actors', { constraintName: 'custom_constraint_name' });
        expect(constraintsAfterRemove).to.have.length(0);
      });
    }

    if (sequelize.dialect.supports.constraints.default) {
      it('should add, show, delete DEFAULT constraints', async () => {
        await queryInterface.addConstraint('actors', {
          name: 'custom_constraint_name',
          type: 'DEFAULT',
          fields: ['status'],
          defaultValue: 'active',
        });

        const [columnName, constraintType] = await Promise.all([
          queryInterface.showConstraints('actors', { columnName: 'status' }),
          queryInterface.showConstraints('actors', { constraintType: 'DEFAULT' }),
        ]);
        expect(columnName).to.have.length(1);
        expect(columnName[0].columnNames).to.deep.equal(['status']);
        expect(constraintType).to.have.length(1);
        expect(constraintType[0].constraintType).to.equal('DEFAULT');

        const constraints = await queryInterface.showConstraints('actors', { constraintName: 'custom_constraint_name' });
        expect(constraints).to.have.length(1);

        const [_default] = constraints;
        expect(_default.constraintSchema).to.equal(defaultSchema);
        expect(_default.constraintName).to.equal('custom_constraint_name');
        expect(_default.constraintType).to.equal('DEFAULT');
        expect(_default.tableName).to.equal('actors');
        expect(_default.tableSchema).to.equal(defaultSchema);
        expect(_default.columnNames).to.deep.equal(['status']);
        expect(_default.definition).to.not.be.null;

        await queryInterface.removeConstraint('actors', 'custom_constraint_name');
        const constraintsAfterRemove = await queryInterface.showConstraints('actors', { constraintName: 'custom_constraint_name' });
        expect(constraintsAfterRemove).to.have.length(0);
      });
    }

    if (sequelize.dialect.supports.constraints.unique) {
      it('should add, show, delete UNIQUE constraints', async () => {
        await queryInterface.addConstraint('actors', {
          name: 'custom_constraint_name',
          type: 'UNIQUE',
          fields: ['name', 'age'],
        });

        const [columnName, constraintType] = await Promise.all([
          queryInterface.showConstraints('actors', { columnName: 'name' }),
          queryInterface.showConstraints('actors', { constraintType: 'UNIQUE' }),
        ]);
        expect(columnName).to.have.length(1);
        expect(columnName[0].columnNames).to.deep.equal(['name']);
        expect(constraintType).to.have.length(1);
        expect(constraintType[0].constraintType).to.equal('UNIQUE');

        const constraints = await queryInterface.showConstraints('actors', { constraintName: 'custom_constraint_name' });
        expect(constraints).to.have.length(1);

        const [unique] = constraints;
        expect(unique.constraintSchema).to.equal(defaultSchema);
        expect(unique.constraintName).to.equal('custom_constraint_name');
        expect(unique.constraintType).to.equal('UNIQUE');
        expect(unique.tableName).to.equal('actors');
        expect(unique.tableSchema).to.equal(defaultSchema);
        expect(unique.columnNames).to.deep.equal(['name', 'age']);

        await queryInterface.removeConstraint('actors', 'custom_constraint_name');
        const constraintsAfterRemove = await queryInterface.showConstraints('actors', { constraintName: 'custom_constraint_name' });
        expect(constraintsAfterRemove).to.have.length(0);
      });
    }

    if (sequelize.dialect.supports.constraints.foreignKey) {
      it('should add, show, delete FOREIGN KEY constraints', async () => {
        await queryInterface.addConstraint('levels', {
          name: 'pk_levels',
          type: 'PRIMARY KEY',
          fields: ['id'],
        });

        await queryInterface.addConstraint('actors', {
          name: 'custom_constraint_name',
          type: 'FOREIGN KEY',
          fields: ['level_id'],
          references: {
            table: 'levels',
            field: 'id',
          },
          onDelete: 'CASCADE',
        });

        const [columnName, constraintType] = await Promise.all([
          queryInterface.showConstraints('actors', { columnName: 'level_id' }),
          queryInterface.showConstraints('actors', { constraintType: 'FOREIGN KEY' }),
        ]);
        expect(columnName).to.have.length(1);
        expect(columnName[0].columnNames).to.deep.equal(['level_id']);
        expect(constraintType).to.have.length(1);
        expect(constraintType[0].constraintType).to.equal('FOREIGN KEY');

        const constraints = await queryInterface.showConstraints('actors', { constraintName: 'custom_constraint_name' });
        expect(constraints).to.have.length(1);

        const [foreignKey] = constraints;
        expect(foreignKey.constraintSchema).to.equal(defaultSchema);
        expect(foreignKey.constraintName).to.equal('custom_constraint_name');
        expect(foreignKey.constraintType).to.equal('FOREIGN KEY');
        expect(foreignKey.tableName).to.equal('actors');
        expect(foreignKey.tableSchema).to.equal(defaultSchema);
        expect(foreignKey.columnNames).to.deep.equal(['level_id']);
        expect(foreignKey.referencedTableName).to.equal('levels');
        expect(foreignKey.referencedTableSchema).to.equal(defaultSchema);
        expect(foreignKey.referencedColumnNames).to.deep.equal(['id']);
        expect(foreignKey.deleteAction).to.equal('CASCADE');

        await queryInterface.removeConstraint('actors', 'custom_constraint_name');
        const constraintsAfterRemove = await queryInterface.showConstraints('actors', { constraintName: 'custom_constraint_name' });
        expect(constraintsAfterRemove).to.have.length(0);
      });

      it('should add, show, delete composite FOREIGN KEY constraints', async () => {
        await queryInterface.addConstraint('levels', {
          name: 'pk_levels',
          type: 'PRIMARY KEY',
          fields: ['id', 'manager_id'],
        });

        await queryInterface.addConstraint('actors', {
          name: 'custom_constraint_name',
          type: 'FOREIGN KEY',
          fields: ['level_id', 'manager_id'],
          references: {
            table: 'levels',
            fields: ['id', 'manager_id'],
          },
          onDelete: 'CASCADE',
        });

        const [columnName, constraintType] = await Promise.all([
          queryInterface.showConstraints('actors', { columnName: 'manager_id' }),
          queryInterface.showConstraints('actors', { constraintType: 'FOREIGN KEY' }),
        ]);
        expect(columnName).to.have.length(1);
        expect(columnName[0].columnNames).to.deep.equal(['manager_id']);
        expect(constraintType).to.have.length(1);
        expect(constraintType[0].constraintType).to.equal('FOREIGN KEY');

        const constraints = await queryInterface.showConstraints('actors', { constraintName: 'custom_constraint_name' });
        expect(constraints).to.have.length(1);

        const [foreignKey] = constraints;
        expect(foreignKey.constraintSchema).to.equal(defaultSchema);
        expect(foreignKey.constraintName).to.equal('custom_constraint_name');
        expect(foreignKey.constraintType).to.equal('FOREIGN KEY');
        expect(foreignKey.tableName).to.equal('actors');
        expect(foreignKey.tableSchema).to.equal(defaultSchema);
        expect(foreignKey.columnNames).to.deep.equal(['level_id', 'manager_id']);
        expect(foreignKey.referencedTableName).to.equal('levels');
        expect(foreignKey.referencedTableSchema).to.equal(defaultSchema);
        expect(foreignKey.referencedColumnNames).to.deep.equal(['id', 'manager_id']);
        expect(foreignKey.deleteAction).to.equal('CASCADE');

        await queryInterface.removeConstraint('actors', 'custom_constraint_name');
        const constraintsAfterRemove = await queryInterface.showConstraints('actors', { constraintName: 'custom_constraint_name' });
        expect(constraintsAfterRemove).to.have.length(0);
      });

      if (sequelize.dialect.supports.constraints.onUpdate) {
        it('should add, show, delete FOREIGN KEY constraints with onUpdate', async () => {
          await queryInterface.addConstraint('levels', {
            name: 'pk_levels',
            type: 'PRIMARY KEY',
            fields: ['id'],
          });

          await queryInterface.addConstraint('actors', {
            name: 'custom_constraint_name',
            type: 'FOREIGN KEY',
            fields: ['level_id'],
            references: {
              table: 'levels',
              field: 'id',
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          });

          const constraints = await queryInterface.showConstraints('actors', { constraintName: 'custom_constraint_name' });
          expect(constraints).to.have.length(1);

          const [foreignKey] = constraints;
          expect(foreignKey.constraintSchema).to.equal(defaultSchema);
          expect(foreignKey.constraintName).to.equal('custom_constraint_name');
          expect(foreignKey.constraintType).to.equal('FOREIGN KEY');
          expect(foreignKey.tableName).to.equal('actors');
          expect(foreignKey.tableSchema).to.equal(defaultSchema);
          expect(foreignKey.columnNames).to.deep.equal(['level_id']);
          expect(foreignKey.referencedTableName).to.equal('levels');
          expect(foreignKey.referencedTableSchema).to.equal(defaultSchema);
          expect(foreignKey.referencedColumnNames).to.deep.equal(['id']);
          expect(foreignKey.deleteAction).to.equal('CASCADE');
          expect(foreignKey.updateAction).to.equal('CASCADE');
        });
      }
    }

    if (sequelize.dialect.supports.constraints.primaryKey) {
      it('should add, show, delete PRIMARY KEY constraints', async () => {
        await queryInterface.addConstraint('actors', {
          name: 'custom_constraint_name',
          type: 'PRIMARY KEY',
          fields: ['id'],
        });

        const [columnName, constraintType] = await Promise.all([
          queryInterface.showConstraints('actors', { columnName: 'id' }),
          queryInterface.showConstraints('actors', { constraintType: 'PRIMARY KEY' }),
        ]);
        expect(columnName).to.have.length(1);
        expect(columnName[0].columnNames).to.deep.equal(['id']);
        expect(constraintType).to.have.length(1);
        expect(constraintType[0].constraintType).to.equal('PRIMARY KEY');

        if (['mariadb', 'mysql'].includes(dialect)) {
          const constraints = await queryInterface.showConstraints('actors', { constraintName: 'PRIMARY' });
          expect(constraints).to.have.length(1);

          const [primaryKey] = constraints;
          expect(primaryKey.constraintSchema).to.equal(defaultSchema);
          expect(primaryKey.constraintName).to.equal('PRIMARY');
          expect(primaryKey.constraintType).to.equal('PRIMARY KEY');
          expect(primaryKey.tableName).to.equal('actors');
          expect(primaryKey.tableSchema).to.equal(defaultSchema);
          expect(primaryKey.columnNames).to.deep.equal(['id']);

          await queryInterface.removeConstraint('actors', 'PRIMARY');
          const constraintsAfterRemove = await queryInterface.showConstraints('actors', { constraintName: 'PRIMARY' });
          expect(constraintsAfterRemove).to.have.length(0);
        } else {
          const constraints = await queryInterface.showConstraints('actors', { constraintName: 'custom_constraint_name' });
          expect(constraints).to.have.length(1);

          const [primaryKey] = constraints;
          expect(primaryKey.constraintSchema).to.equal(defaultSchema);
          expect(primaryKey.constraintName).to.equal('custom_constraint_name');
          expect(primaryKey.constraintType).to.equal('PRIMARY KEY');
          expect(primaryKey.tableName).to.equal('actors');
          expect(primaryKey.tableSchema).to.equal(defaultSchema);
          expect(primaryKey.columnNames).to.deep.equal(['id']);

          await queryInterface.removeConstraint('actors', 'custom_constraint_name');
          const constraintsAfterRemove = await queryInterface.showConstraints('actors', { constraintName: 'custom_constraint_name' });
          expect(constraintsAfterRemove).to.have.length(0);
        }
      });

      it('should add, show, delete composite PRIMARY KEY constraints', async () => {
        await queryInterface.addConstraint('levels', {
          name: 'custom_constraint_name',
          type: 'PRIMARY KEY',
          fields: ['id', 'manager_id'],
        });

        const [columnName, constraintType] = await Promise.all([
          queryInterface.showConstraints('levels', { columnName: 'manager_id' }),
          queryInterface.showConstraints('levels', { constraintType: 'PRIMARY KEY' }),
        ]);
        expect(columnName).to.have.length(1);
        expect(columnName[0].columnNames).to.deep.equal(['manager_id']);
        expect(constraintType).to.have.length(1);
        expect(constraintType[0].constraintType).to.equal('PRIMARY KEY');

        if (['mariadb', 'mysql'].includes(dialect)) {
          const constraints = await queryInterface.showConstraints('levels', { constraintName: 'PRIMARY' });
          expect(constraints).to.have.length(1);

          const [primaryKey] = constraints;
          expect(primaryKey.constraintSchema).to.equal(defaultSchema);
          expect(primaryKey.constraintName).to.equal('PRIMARY');
          expect(primaryKey.constraintType).to.equal('PRIMARY KEY');
          expect(primaryKey.tableName).to.equal('levels');
          expect(primaryKey.tableSchema).to.equal(defaultSchema);
          expect(primaryKey.columnNames).to.deep.equal(['id', 'manager_id']);

          await queryInterface.removeConstraint('levels', 'PRIMARY');
          const constraintsAfterRemove = await queryInterface.showConstraints('actors', { constraintName: 'PRIMARY' });
          expect(constraintsAfterRemove).to.have.length(0);
        } else {
          const constraints = await queryInterface.showConstraints('levels', { constraintName: 'custom_constraint_name' });
          expect(constraints).to.have.length(1);

          const [primaryKey] = constraints;
          expect(primaryKey.constraintSchema).to.equal(defaultSchema);
          expect(primaryKey.constraintName).to.equal('custom_constraint_name');
          expect(primaryKey.constraintType).to.equal('PRIMARY KEY');
          expect(primaryKey.tableName).to.equal('levels');
          expect(primaryKey.tableSchema).to.equal(defaultSchema);
          expect(primaryKey.columnNames).to.deep.equal(['id', 'manager_id']);

          await queryInterface.removeConstraint('levels', 'custom_constraint_name');
          const constraintsAfterRemove = await queryInterface.showConstraints('levels', { constraintName: 'custom_constraint_name' });
          expect(constraintsAfterRemove).to.have.length(0);
        }
      });
    }
  });

  if (sequelize.dialect.supports.schemas) {
    describe('With schema', () => {
      const schema = 'archive';

      beforeEach(async () => {
        await queryInterface.createSchema(schema);

        await queryInterface.createTable({
          tableName: 'levels',
          schema,
        }, {
          id: {
            type: DataTypes.INTEGER,
            allowNull: false,
          },
          manager_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
          },
          name: {
            type: DataTypes.STRING,
            allowNull: false,
          },
        });

        await queryInterface.createTable({
          tableName: 'actors',
          schema,
        }, {
          id: {
            type: DataTypes.INTEGER,
            allowNull: false,
          },
          manager_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
          },
          name: {
            type: DataTypes.STRING,
            allowNull: false,
          },
          status: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          age: {
            type: DataTypes.INTEGER,
            allowNull: false,
          },
          level_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
          },
        });
      });

      if (sequelize.dialect.supports.constraints.check) {
        it('should add, show, delete CHECK constraint', async () => {
          await queryInterface.addConstraint({ tableName: 'actors', schema }, {
            name: 'custom_constraint_name',
            type: 'CHECK',
            fields: ['age'],
            where: {
              age: {
                [Op.gt]: 10,
              },
            },
          });

          const constraintType = await queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintType: 'CHECK' });
          if (dialect === 'postgres') {
            // Postgres adds a CHECK constraint for each column with not null
            expect(constraintType).to.have.length(6);
            expect(constraintType[5].constraintType).to.equal('CHECK');
          } else {
            expect(constraintType).to.have.length(1);
            expect(constraintType[0].constraintType).to.equal('CHECK');
          }

          const constraints = await queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintName: 'custom_constraint_name' });
          expect(constraints).to.have.length(1);

          const [check] = constraints;
          expect(check.constraintSchema).to.equal(schema);
          expect(check.constraintName).to.equal('custom_constraint_name');
          expect(check.constraintType).to.equal('CHECK');
          expect(check.tableName).to.equal('actors');
          expect(check.tableSchema).to.equal(schema);
          expect(check.definition).to.not.be.null;

          await queryInterface.removeConstraint({ tableName: 'actors', schema }, 'custom_constraint_name');
          const constraintsAfterRemove = await queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintName: 'custom_constraint_name' });
          expect(constraintsAfterRemove).to.have.length(0);
        });
      }

      if (sequelize.dialect.supports.constraints.default) {
        it('should add, show, delete DEFAULT constraints', async () => {
          await queryInterface.addConstraint({ tableName: 'actors', schema }, {
            name: 'custom_constraint_name',
            type: 'DEFAULT',
            fields: ['status'],
            defaultValue: 'active',
          });

          const [columnName, constraintType] = await Promise.all([
            queryInterface.showConstraints({ tableName: 'actors', schema }, { columnName: 'status' }),
            queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintType: 'DEFAULT' }),
          ]);
          expect(columnName).to.have.length(1);
          expect(columnName[0].columnNames).to.deep.equal(['status']);
          expect(constraintType).to.have.length(1);
          expect(constraintType[0].constraintType).to.equal('DEFAULT');

          const constraints = await queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintName: 'custom_constraint_name' });
          expect(constraints).to.have.length(1);

          const [_default] = constraints;
          expect(_default.constraintSchema).to.equal(schema);
          expect(_default.constraintName).to.equal('custom_constraint_name');
          expect(_default.constraintType).to.equal('DEFAULT');
          expect(_default.tableName).to.equal('actors');
          expect(_default.tableSchema).to.equal(schema);
          expect(_default.columnNames).to.deep.equal(['status']);
          expect(_default.definition).to.not.be.null;

          await queryInterface.removeConstraint({ tableName: 'actors', schema }, 'custom_constraint_name');
          const constraintsAfterRemove = await queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintName: 'custom_constraint_name' });
          expect(constraintsAfterRemove).to.have.length(0);
        });
      }

      if (sequelize.dialect.supports.constraints.unique) {
        it('should add, show, delete UNIQUE constraints', async () => {
          await queryInterface.addConstraint({ tableName: 'actors', schema }, {
            name: 'custom_constraint_name',
            type: 'UNIQUE',
            fields: ['name', 'age'],
          });

          const [columnName, constraintType] = await Promise.all([
            queryInterface.showConstraints({ tableName: 'actors', schema }, { columnName: 'name' }),
            queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintType: 'UNIQUE' }),
          ]);
          expect(columnName).to.have.length(1);
          expect(columnName[0].columnNames).to.deep.equal(['name']);
          expect(constraintType).to.have.length(1);
          expect(constraintType[0].constraintType).to.equal('UNIQUE');

          const constraints = await queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintName: 'custom_constraint_name' });
          expect(constraints).to.have.length(1);

          const [unique] = constraints;
          expect(unique.constraintSchema).to.equal(schema);
          expect(unique.constraintName).to.equal('custom_constraint_name');
          expect(unique.constraintType).to.equal('UNIQUE');
          expect(unique.tableName).to.equal('actors');
          expect(unique.tableSchema).to.equal(schema);
          expect(unique.columnNames).to.deep.equal(['name', 'age']);

          await queryInterface.removeConstraint({ tableName: 'actors', schema }, 'custom_constraint_name');
          const constraintsAfterRemove = await queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintName: 'custom_constraint_name' });
          expect(constraintsAfterRemove).to.have.length(0);
        });
      }

      if (sequelize.dialect.supports.constraints.foreignKey) {
        it('should add, show, delete FOREIGN KEY constraints', async () => {
          await queryInterface.addConstraint({ tableName: 'levels', schema }, {
            name: 'pk_levels',
            type: 'PRIMARY KEY',
            fields: ['id'],
          });

          await queryInterface.addConstraint({ tableName: 'actors', schema }, {
            name: 'custom_constraint_name',
            type: 'FOREIGN KEY',
            fields: ['level_id'],
            references: {
              table: { tableName: 'levels', schema },
              field: 'id',
            },
            onDelete: 'CASCADE',
          });

          const [columnName, constraintType] = await Promise.all([
            queryInterface.showConstraints({ tableName: 'actors', schema }, { columnName: 'level_id' }),
            queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintType: 'FOREIGN KEY' }),
          ]);
          expect(columnName).to.have.length(1);
          expect(columnName[0].columnNames).to.deep.equal(['level_id']);
          expect(constraintType).to.have.length(1);
          expect(constraintType[0].constraintType).to.equal('FOREIGN KEY');

          const constraints = await queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintName: 'custom_constraint_name' });
          expect(constraints).to.have.length(1);

          const [foreignKey] = constraints;
          expect(foreignKey.constraintSchema).to.equal(schema);
          expect(foreignKey.constraintName).to.equal('custom_constraint_name');
          expect(foreignKey.constraintType).to.equal('FOREIGN KEY');
          expect(foreignKey.tableName).to.equal('actors');
          expect(foreignKey.tableSchema).to.equal(schema);
          expect(foreignKey.columnNames).to.deep.equal(['level_id']);
          expect(foreignKey.referencedTableName).to.equal('levels');
          expect(foreignKey.referencedTableSchema).to.equal(schema);
          expect(foreignKey.referencedColumnNames).to.deep.equal(['id']);
          expect(foreignKey.deleteAction).to.equal('CASCADE');

          await queryInterface.removeConstraint({ tableName: 'actors', schema }, 'custom_constraint_name');
          const constraintsAfterRemove = await queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintName: 'custom_constraint_name' });
          expect(constraintsAfterRemove).to.have.length(0);
        });

        it('should add, show, delete composite FOREIGN KEY constraints', async () => {
          await queryInterface.addConstraint({ tableName: 'levels', schema }, {
            name: 'pk_levels',
            type: 'PRIMARY KEY',
            fields: ['id', 'manager_id'],
          });

          await queryInterface.addConstraint({ tableName: 'actors', schema }, {
            name: 'custom_constraint_name',
            type: 'FOREIGN KEY',
            fields: ['level_id', 'manager_id'],
            references: {
              table: { tableName: 'levels', schema },
              fields: ['id', 'manager_id'],
            },
            onDelete: 'CASCADE',
          });

          const [columnName, constraintType] = await Promise.all([
            queryInterface.showConstraints({ tableName: 'actors', schema }, { columnName: 'manager_id' }),
            queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintType: 'FOREIGN KEY' }),
          ]);
          expect(columnName).to.have.length(1);
          expect(columnName[0].columnNames).to.deep.equal(['manager_id']);
          expect(constraintType).to.have.length(1);
          expect(constraintType[0].constraintType).to.equal('FOREIGN KEY');

          const constraints = await queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintName: 'custom_constraint_name' });
          expect(constraints).to.have.length(1);

          const [foreignKey] = constraints;
          expect(foreignKey.constraintSchema).to.equal(schema);
          expect(foreignKey.constraintName).to.equal('custom_constraint_name');
          expect(foreignKey.constraintType).to.equal('FOREIGN KEY');
          expect(foreignKey.tableName).to.equal('actors');
          expect(foreignKey.tableSchema).to.equal(schema);
          expect(foreignKey.columnNames).to.deep.equal(['level_id', 'manager_id']);
          expect(foreignKey.referencedTableName).to.equal('levels');
          expect(foreignKey.referencedTableSchema).to.equal(schema);
          expect(foreignKey.referencedColumnNames).to.deep.equal(['id', 'manager_id']);
          expect(foreignKey.deleteAction).to.equal('CASCADE');

          await queryInterface.removeConstraint({ tableName: 'actors', schema }, 'custom_constraint_name');
          const constraintsAfterRemove = await queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintName: 'custom_constraint_name' });
          expect(constraintsAfterRemove).to.have.length(0);
        });

        if (sequelize.dialect.supports.constraints.onUpdate) {
          it('should add, show, delete FOREIGN KEY constraints with onUpdate', async () => {
            await queryInterface.addConstraint({ tableName: 'levels', schema }, {
              name: 'pk_levels',
              type: 'PRIMARY KEY',
              fields: ['id'],
            });

            await queryInterface.addConstraint({ tableName: 'actors', schema }, {
              name: 'custom_constraint_name',
              type: 'FOREIGN KEY',
              fields: ['level_id'],
              references: {
                table: { tableName: 'levels', schema },
                field: 'id',
              },
              onDelete: 'CASCADE',
              onUpdate: 'CASCADE',
            });

            const constraints = await queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintName: 'custom_constraint_name' });
            expect(constraints).to.have.length(1);

            const [foreignKey] = constraints;
            expect(foreignKey.constraintSchema).to.equal(schema);
            expect(foreignKey.constraintName).to.equal('custom_constraint_name');
            expect(foreignKey.constraintType).to.equal('FOREIGN KEY');
            expect(foreignKey.tableName).to.equal('actors');
            expect(foreignKey.tableSchema).to.equal(schema);
            expect(foreignKey.columnNames).to.deep.equal(['level_id']);
            expect(foreignKey.referencedTableName).to.equal('levels');
            expect(foreignKey.referencedTableSchema).to.equal(schema);
            expect(foreignKey.referencedColumnNames).to.deep.equal(['id']);
            expect(foreignKey.deleteAction).to.equal('CASCADE');
            expect(foreignKey.updateAction).to.equal('CASCADE');
          });
        }
      }

      if (sequelize.dialect.supports.constraints.primaryKey) {
        it('should add, show, delete PRIMARY KEY constraints', async () => {
          await queryInterface.addConstraint({ tableName: 'actors', schema }, {
            name: 'custom_constraint_name',
            type: 'PRIMARY KEY',
            fields: ['id'],
          });

          const [columnName, constraintType] = await Promise.all([
            queryInterface.showConstraints({ tableName: 'actors', schema }, { columnName: 'id' }),
            queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintType: 'PRIMARY KEY' }),
          ]);
          expect(columnName).to.have.length(1);
          expect(columnName[0].columnNames).to.deep.equal(['id']);
          expect(constraintType).to.have.length(1);
          expect(constraintType[0].constraintType).to.equal('PRIMARY KEY');

          // MariaDB and MySQL do not support named primary keys
          if (['mariadb', 'mysql'].includes(dialect)) {
            const constraints = await queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintName: 'PRIMARY' });
            expect(constraints).to.have.length(1);

            const [primaryKey] = constraints;
            expect(primaryKey.constraintSchema).to.equal(schema);
            expect(primaryKey.constraintName).to.equal('PRIMARY');
            expect(primaryKey.constraintType).to.equal('PRIMARY KEY');
            expect(primaryKey.tableName).to.equal('actors');
            expect(primaryKey.tableSchema).to.equal(schema);
            expect(primaryKey.columnNames).to.deep.equal(['id']);

            await queryInterface.removeConstraint({ tableName: 'actors', schema }, 'PRIMARY');
            const constraintsAfterRemove = await queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintName: 'PRIMARY' });
            expect(constraintsAfterRemove).to.have.length(0);
          } else {
            const constraints = await queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintName: 'custom_constraint_name' });
            expect(constraints).to.have.length(1);

            const [primaryKey] = constraints;
            expect(primaryKey.constraintSchema).to.equal(schema);
            expect(primaryKey.constraintName).to.equal('custom_constraint_name');
            expect(primaryKey.constraintType).to.equal('PRIMARY KEY');
            expect(primaryKey.tableName).to.equal('actors');
            expect(primaryKey.tableSchema).to.equal(schema);
            expect(primaryKey.columnNames).to.deep.equal(['id']);

            await queryInterface.removeConstraint({ tableName: 'actors', schema }, 'custom_constraint_name');
            const constraintsAfterRemove = await queryInterface.showConstraints({ tableName: 'actors', schema }, { constraintName: 'custom_constraint_name' });
            expect(constraintsAfterRemove).to.have.length(0);
          }
        });

        it('should add, show, delete composite PRIMARY KEY constraints', async () => {
          await queryInterface.addConstraint({ tableName: 'levels', schema }, {
            name: 'custom_constraint_name',
            type: 'PRIMARY KEY',
            fields: ['id', 'manager_id'],
          });

          const [columnName, constraintType] = await Promise.all([
            queryInterface.showConstraints({ tableName: 'levels', schema }, { columnName: 'manager_id' }),
            queryInterface.showConstraints({ tableName: 'levels', schema }, { constraintType: 'PRIMARY KEY' }),
          ]);
          expect(columnName).to.have.length(1);
          expect(columnName[0].columnNames).to.deep.equal(['manager_id']);
          expect(constraintType).to.have.length(1);
          expect(constraintType[0].constraintType).to.equal('PRIMARY KEY');

          if (['mariadb', 'mysql'].includes(dialect)) {
            const constraints = await queryInterface.showConstraints({ tableName: 'levels', schema }, { constraintName: 'PRIMARY' });
            expect(constraints).to.have.length(1);

            const [primaryKey] = constraints;
            expect(primaryKey.constraintSchema).to.equal(schema);
            expect(primaryKey.constraintName).to.equal('PRIMARY');
            expect(primaryKey.constraintType).to.equal('PRIMARY KEY');
            expect(primaryKey.tableName).to.equal('levels');
            expect(primaryKey.tableSchema).to.equal(schema);
            expect(primaryKey.columnNames).to.deep.equal(['id', 'manager_id']);

            await queryInterface.removeConstraint({ tableName: 'levels', schema }, 'PRIMARY');
            const constraintsAfterRemove = await queryInterface.showConstraints({ tableName: 'levels', schema }, { constraintName: 'PRIMARY' });
            expect(constraintsAfterRemove).to.have.length(0);
          } else {
            const constraints = await queryInterface.showConstraints({ tableName: 'levels', schema }, { constraintName: 'custom_constraint_name' });
            expect(constraints).to.have.length(1);

            const [primaryKey] = constraints;
            expect(primaryKey.constraintSchema).to.equal(schema);
            expect(primaryKey.constraintName).to.equal('custom_constraint_name');
            expect(primaryKey.constraintType).to.equal('PRIMARY KEY');
            expect(primaryKey.tableName).to.equal('levels');
            expect(primaryKey.tableSchema).to.equal(schema);
            expect(primaryKey.columnNames).to.deep.equal(['id', 'manager_id']);

            await queryInterface.removeConstraint({ tableName: 'levels', schema }, 'custom_constraint_name');
            const constraintsAfterRemove = await queryInterface.showConstraints({ tableName: 'levels', schema }, { constraintName: 'custom_constraint_name' });
            expect(constraintsAfterRemove).to.have.length(0);
          }
        });
      }
    });
  }
});
