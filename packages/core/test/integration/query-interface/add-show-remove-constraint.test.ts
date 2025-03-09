import { AggregateError, DataTypes, Op, UnknownConstraintError } from '@sequelize/core';
import { assert, expect } from 'chai';
import { sequelize } from '../support';

const queryInterface = sequelize.queryInterface;
const dialect = sequelize.dialect.name;

describe('QueryInterface#{add,show,removeConstraint}', () => {
  describe('Without schema', () => {
    const defaultSchema = sequelize.dialect.getDefaultSchema();

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

    it('should throw an error if constraint type is missing', async () => {
      await expect(
        // @ts-expect-error -- intentionally missing type
        queryInterface.addConstraint('levels', {
          fields: ['roles'],
          where: { roles: ['user', 'admin', 'guest', 'moderator'] },
          name: 'check_user_roles',
        }),
      ).to.be.rejectedWith(Error, 'Constraint type must be specified through options.type');
    });

    it('should throw non existent constraints as UnknownConstraintError', async () => {
      try {
        await queryInterface.removeConstraint('levels', 'unknown__constraint__name', {
          type: 'unique',
        });
        expect.fail('Expected to throw an error');
      } catch (error) {
        let err = error;
        if (dialect === 'mssql') {
          assert(
            error instanceof AggregateError,
            'Expected error to be an instance of AggregateError',
          );
          err = error.errors.at(-1);
        } else {
          assert(
            err instanceof UnknownConstraintError,
            'Expected error to be an instance of UnknownConstraintError',
          );
          if (dialect !== 'ibmi') {
            expect(err.table).to.equal('levels');
          }

          expect(err.constraint).to.equal('unknown__constraint__name');
        }
      }
    });

    it('should add, show and delete a UNIQUE constraint', async () => {
      await queryInterface.addConstraint('actors', {
        name: 'custom_constraint_name',
        type: 'UNIQUE',
        fields: ['name', 'age'],
      });

      const constraintType = await queryInterface.showConstraints('actors', {
        constraintType: 'UNIQUE',
      });
      const constraints = constraintType.filter(
        constraint => constraint.constraintName === 'custom_constraint_name',
      );
      expect(constraints).to.have.length(1);
      expect(constraints[0]).to.deep.equal({
        ...(['mssql', 'postgres'].includes(dialect) && { constraintCatalog: 'sequelize_test' }),
        constraintSchema: defaultSchema,
        constraintName: 'custom_constraint_name',
        constraintType: 'UNIQUE',
        ...(['mssql', 'postgres'].includes(dialect) && { tableCatalog: 'sequelize_test' }),
        tableSchema: defaultSchema,
        tableName: 'actors',
        columnNames: ['name', 'age'],
        ...(sequelize.dialect.supports.constraints.deferrable && {
          deferrable: 'INITIALLY_IMMEDIATE',
        }),
      });

      await queryInterface.removeConstraint('actors', 'custom_constraint_name');
      const constraintsAfterRemove = await queryInterface.showConstraints('actors', {
        constraintName: 'custom_constraint_name',
      });
      expect(constraintsAfterRemove).to.have.length(0);
    });

    it('should add, show and delete a PRIMARY & FOREIGN KEY constraint', async () => {
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

      const foreignKeys = await queryInterface.showConstraints('actors', {
        columnName: 'level_id',
        constraintType: 'FOREIGN KEY',
      });
      expect(foreignKeys).to.have.length(1);
      expect(foreignKeys[0]).to.deep.equal({
        ...(['mssql', 'postgres'].includes(dialect) && { constraintCatalog: 'sequelize_test' }),
        constraintSchema: defaultSchema,
        constraintName: 'custom_constraint_name',
        constraintType: 'FOREIGN KEY',
        ...(['mssql', 'postgres'].includes(dialect) && { tableCatalog: 'sequelize_test' }),
        tableSchema: defaultSchema,
        tableName: 'actors',
        columnNames: ['level_id'],
        referencedTableName: 'levels',
        referencedTableSchema: defaultSchema,
        referencedColumnNames: ['id'],
        deleteAction: 'CASCADE',
        updateAction: dialect === 'mariadb' ? 'RESTRICT' : dialect === 'sqlite3' ? '' : 'NO ACTION',
        ...(sequelize.dialect.supports.constraints.deferrable && {
          deferrable: 'INITIALLY_IMMEDIATE',
        }),
      });

      await queryInterface.removeConstraint('actors', 'custom_constraint_name');
      const fkAfterRemove = await queryInterface.showConstraints('actors', {
        constraintName: 'custom_constraint_name',
      });
      expect(fkAfterRemove).to.have.length(0);

      const primaryKeys = await queryInterface.showConstraints('levels', {
        columnName: 'id',
        constraintType: 'PRIMARY KEY',
      });
      expect(primaryKeys).to.have.length(1);
      expect(primaryKeys[0]).to.deep.equal({
        ...(['mssql', 'postgres'].includes(dialect) && { constraintCatalog: 'sequelize_test' }),
        constraintSchema: defaultSchema,
        constraintName: ['mariadb', 'mysql'].includes(dialect) ? 'PRIMARY' : 'pk_levels',
        constraintType: 'PRIMARY KEY',
        ...(['mssql', 'postgres'].includes(dialect) && { tableCatalog: 'sequelize_test' }),
        tableSchema: defaultSchema,
        tableName: 'levels',
        columnNames: ['id'],
        ...(sequelize.dialect.supports.constraints.deferrable && {
          deferrable: 'INITIALLY_IMMEDIATE',
        }),
      });

      await queryInterface.removeConstraint(
        'levels',
        ['mariadb', 'mysql'].includes(dialect) ? 'PRIMARY' : 'pk_levels',
      );
      const pkAfterRemove = await queryInterface.showConstraints('levels', {
        constraintName: ['mariadb', 'mysql'].includes(dialect) ? 'PRIMARY' : 'pk_levels',
      });
      expect(pkAfterRemove).to.have.length(0);
    });

    it('should add, show and delete a composite PRIMARY & FOREIGN KEY constraint', async () => {
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

      const foreignKeys = await queryInterface.showConstraints('actors', {
        constraintType: 'FOREIGN KEY',
      });
      expect(foreignKeys).to.have.length(1);
      expect(foreignKeys[0]).to.deep.equal({
        ...(['mssql', 'postgres'].includes(dialect) && { constraintCatalog: 'sequelize_test' }),
        constraintSchema: defaultSchema,
        constraintName: 'custom_constraint_name',
        constraintType: 'FOREIGN KEY',
        ...(['mssql', 'postgres'].includes(dialect) && { tableCatalog: 'sequelize_test' }),
        tableSchema: defaultSchema,
        tableName: 'actors',
        columnNames: ['level_id', 'manager_id'],
        referencedTableSchema: defaultSchema,
        referencedTableName: 'levels',
        referencedColumnNames: ['id', 'manager_id'],
        deleteAction: 'CASCADE',
        updateAction: dialect === 'mariadb' ? 'RESTRICT' : dialect === 'sqlite3' ? '' : 'NO ACTION',
        ...(sequelize.dialect.supports.constraints.deferrable && {
          deferrable: 'INITIALLY_IMMEDIATE',
        }),
      });

      await queryInterface.removeConstraint('actors', 'custom_constraint_name');
      const fkAfterRemove = await queryInterface.showConstraints('actors', {
        constraintName: 'custom_constraint_name',
      });
      expect(fkAfterRemove).to.have.length(0);

      const primaryKeys = await queryInterface.showConstraints('levels', {
        constraintType: 'PRIMARY KEY',
      });
      expect(primaryKeys).to.have.length(1);
      expect(primaryKeys[0]).to.deep.equal({
        ...(['mssql', 'postgres'].includes(dialect) && { constraintCatalog: 'sequelize_test' }),
        constraintSchema: defaultSchema,
        constraintName: ['mariadb', 'mysql'].includes(dialect) ? 'PRIMARY' : 'pk_levels',
        constraintType: 'PRIMARY KEY',
        ...(['mssql', 'postgres'].includes(dialect) && { tableCatalog: 'sequelize_test' }),
        tableSchema: defaultSchema,
        tableName: 'levels',
        columnNames: ['id', 'manager_id'],
        ...(sequelize.dialect.supports.constraints.deferrable && {
          deferrable: 'INITIALLY_IMMEDIATE',
        }),
      });

      await queryInterface.removeConstraint(
        'levels',
        ['mariadb', 'mysql'].includes(dialect) ? 'PRIMARY' : 'pk_levels',
      );
      const pkAfterRemove = await queryInterface.showConstraints('levels', {
        constraintName: ['mariadb', 'mysql'].includes(dialect) ? 'PRIMARY' : 'pk_levels',
      });
      expect(pkAfterRemove).to.have.length(0);
    });

    if (sequelize.dialect.supports.constraints.onUpdate) {
      it('should add a FOREIGN KEY constraints with onUpdate', async () => {
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

        const constraintType = await queryInterface.showConstraints('actors', {
          columnName: 'level_id',
          constraintType: 'FOREIGN KEY',
        });
        const constraints = constraintType.filter(
          constraint => constraint.constraintName === 'custom_constraint_name',
        );
        expect(constraints).to.have.length(1);
        expect(constraints[0]).to.deep.equal({
          ...(['mssql', 'postgres'].includes(dialect) && { constraintCatalog: 'sequelize_test' }),
          constraintSchema: defaultSchema,
          constraintName: 'custom_constraint_name',
          constraintType: 'FOREIGN KEY',
          ...(['mssql', 'postgres'].includes(dialect) && { tableCatalog: 'sequelize_test' }),
          tableSchema: defaultSchema,
          tableName: 'actors',
          columnNames: ['level_id'],
          referencedTableName: 'levels',
          referencedTableSchema: defaultSchema,
          referencedColumnNames: ['id'],
          deleteAction: 'CASCADE',
          updateAction: 'CASCADE',
          ...(sequelize.dialect.supports.constraints.deferrable && {
            deferrable: 'INITIALLY_IMMEDIATE',
          }),
        });
      });
    }

    if (sequelize.dialect.supports.constraints.check) {
      it('should add, show and delete a CHECK constraint', async () => {
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

        const constraintType = await queryInterface.showConstraints('actors', {
          constraintType: 'CHECK',
        });
        if (dialect === 'postgres') {
          // Postgres adds a CHECK constraint for each column with not null
          expect(constraintType).to.have.length(6);
          expect(constraintType[5].constraintType).to.equal('CHECK');
        } else {
          expect(constraintType).to.have.length(1);
          expect(constraintType[0].constraintType).to.equal('CHECK');
        }

        const constraints = constraintType.filter(
          constraint => constraint.constraintName === 'custom_constraint_name',
        );
        expect(constraints).to.have.length(1);
        expect(constraints[0]).to.deep.equal({
          ...(['mssql', 'postgres'].includes(dialect) && { constraintCatalog: 'sequelize_test' }),
          constraintSchema: defaultSchema,
          constraintName: 'custom_constraint_name',
          constraintType: 'CHECK',
          ...(['mssql', 'postgres'].includes(dialect) && { tableCatalog: 'sequelize_test' }),
          tableSchema: defaultSchema,
          tableName: 'actors',
          definition:
            dialect === 'mssql'
              ? '([age]>(10))'
              : dialect === 'db2'
                ? '"age" > 10'
                : dialect === 'postgres'
                  ? '(age > 10)'
                  : ['mysql', 'sqlite3'].includes(dialect)
                    ? '(`age` > 10)'
                    : '`age` > 10',
          ...(sequelize.dialect.supports.constraints.deferrable && {
            deferrable: 'INITIALLY_IMMEDIATE',
          }),
        });

        await queryInterface.removeConstraint('actors', 'custom_constraint_name');
        const constraintsAfterRemove = await queryInterface.showConstraints('actors', {
          constraintName: 'custom_constraint_name',
        });
        expect(constraintsAfterRemove).to.have.length(0);
      });
    }

    if (sequelize.dialect.supports.constraints.default) {
      it('should add, show and delete a DEFAULT constraints', async () => {
        await queryInterface.addConstraint('actors', {
          name: 'custom_constraint_name',
          type: 'DEFAULT',
          fields: ['status'],
          defaultValue: 'active',
        });

        const constraintType = await queryInterface.showConstraints('actors', {
          columnName: 'status',
          constraintType: 'DEFAULT',
        });
        const constraints = constraintType.filter(
          constraint => constraint.constraintName === 'custom_constraint_name',
        );
        expect(constraints).to.have.length(1);
        expect(constraints[0]).to.deep.equal({
          ...(['mssql', 'postgres'].includes(dialect) && { constraintCatalog: 'sequelize_test' }),
          constraintSchema: defaultSchema,
          constraintName: 'custom_constraint_name',
          constraintType: 'DEFAULT',
          ...(['mssql', 'postgres'].includes(dialect) && { tableCatalog: 'sequelize_test' }),
          tableSchema: defaultSchema,
          tableName: 'actors',
          columnNames: ['status'],
          definition: dialect === 'mssql' ? `(N'active')` : `DEFAULT 'active'`,
          ...(sequelize.dialect.supports.constraints.deferrable && {
            deferrable: 'INITIALLY_IMMEDIATE',
          }),
        });

        await queryInterface.removeConstraint('actors', 'custom_constraint_name');
        const constraintsAfterRemove = await queryInterface.showConstraints('actors', {
          constraintName: 'custom_constraint_name',
        });
        expect(constraintsAfterRemove).to.have.length(0);
      });
    }
  });

  if (sequelize.dialect.supports.schemas) {
    describe('With schema', () => {
      const schema = 'archive';

      beforeEach(async () => {
        await queryInterface.createSchema(schema);

        await queryInterface.createTable(
          {
            tableName: 'levels',
            schema,
          },
          {
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
          },
        );

        await queryInterface.createTable(
          {
            tableName: 'actors',
            schema,
          },
          {
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
          },
        );

        await queryInterface.addConstraint(
          { tableName: 'levels', schema },
          {
            name: 'pk_levels',
            type: 'PRIMARY KEY',
            fields: ['id'],
          },
        );

        await queryInterface.addConstraint(
          { tableName: 'actors', schema },
          {
            name: 'custom_constraint_name',
            type: 'FOREIGN KEY',
            fields: ['level_id'],
            references: {
              table: { tableName: 'levels', schema },
              field: 'id',
            },
            onDelete: 'CASCADE',
          },
        );
      });

      it('should add, show and delete a PRIMARY & FOREIGN KEY constraint', async () => {
        const foreignKeys = await queryInterface.showConstraints(
          { tableName: 'actors', schema },
          { columnName: 'level_id', constraintType: 'FOREIGN KEY' },
        );
        expect(foreignKeys).to.have.length(1);
        expect(foreignKeys[0]).to.deep.equal({
          ...(['mssql', 'postgres'].includes(dialect) && { constraintCatalog: 'sequelize_test' }),
          constraintSchema: schema,
          constraintName: 'custom_constraint_name',
          constraintType: 'FOREIGN KEY',
          ...(['mssql', 'postgres'].includes(dialect) && { tableCatalog: 'sequelize_test' }),
          tableSchema: schema,
          tableName: 'actors',
          columnNames: ['level_id'],
          referencedTableSchema: schema,
          referencedTableName: 'levels',
          referencedColumnNames: ['id'],
          deleteAction: 'CASCADE',
          updateAction:
            dialect === 'mariadb' ? 'RESTRICT' : dialect === 'sqlite3' ? '' : 'NO ACTION',
          ...(sequelize.dialect.supports.constraints.deferrable && {
            deferrable: 'INITIALLY_IMMEDIATE',
          }),
        });

        await queryInterface.removeConstraint(
          { tableName: 'actors', schema },
          'custom_constraint_name',
        );
        const fkAfterRemove = await queryInterface.showConstraints(
          { tableName: 'actors', schema },
          { constraintName: 'custom_constraint_name' },
        );
        expect(fkAfterRemove).to.have.length(0);

        const primaryKeys = await queryInterface.showConstraints(
          { tableName: 'levels', schema },
          { columnName: 'id', constraintType: 'PRIMARY KEY' },
        );
        expect(primaryKeys).to.have.length(1);
        expect(primaryKeys[0]).to.deep.equal({
          ...(['mssql', 'postgres'].includes(dialect) && { constraintCatalog: 'sequelize_test' }),
          constraintSchema: schema,
          constraintName: ['mariadb', 'mysql'].includes(dialect) ? 'PRIMARY' : 'pk_levels',
          constraintType: 'PRIMARY KEY',
          ...(['mssql', 'postgres'].includes(dialect) && { tableCatalog: 'sequelize_test' }),
          tableSchema: schema,
          tableName: 'levels',
          columnNames: ['id'],
          ...(sequelize.dialect.supports.constraints.deferrable && {
            deferrable: 'INITIALLY_IMMEDIATE',
          }),
        });

        await queryInterface.removeConstraint(
          { tableName: 'levels', schema },
          ['mariadb', 'mysql'].includes(dialect) ? 'PRIMARY' : 'pk_levels',
        );
        const pkAfterRemove = await queryInterface.showConstraints(
          { tableName: 'levels', schema },
          { constraintName: ['mariadb', 'mysql'].includes(dialect) ? 'PRIMARY' : 'pk_levels' },
        );
        expect(pkAfterRemove).to.have.length(0);
      });

      describe('when tables are present in different schemas', () => {
        beforeEach(async () => {
          await queryInterface.createTable(
            {
              tableName: 'levels',
            },
            {
              id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
              },
              name: {
                type: DataTypes.STRING,
                allowNull: false,
              },
            },
          );

          await queryInterface.createTable(
            {
              tableName: 'actors',
            },
            {
              id: {
                type: DataTypes.INTEGER,
                allowNull: false,
              },
              name: {
                type: DataTypes.STRING,
                allowNull: false,
              },
              level_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
              },
            },
          );

          await queryInterface.addConstraint(
            { tableName: 'actors' },
            {
              name: 'custom_constraint_name',
              type: 'FOREIGN KEY',
              fields: ['level_id'],
              references: {
                table: { tableName: 'levels' },
                field: 'id',
              },
              onDelete: 'CASCADE',
            },
          );
        });

        it('should show only foreign key constraints for the table in the right schema', async () => {
          const foreignKeys = await queryInterface.showConstraints(
            { tableName: 'actors', schema },
            { columnName: 'level_id', constraintType: 'FOREIGN KEY' },
          );

          expect(foreignKeys).to.have.length(1);
          expect(foreignKeys[0]).to.deep.equal({
            ...(['mssql', 'postgres'].includes(dialect) && { constraintCatalog: 'sequelize_test' }),
            constraintSchema: schema,
            constraintName: 'custom_constraint_name',
            constraintType: 'FOREIGN KEY',
            ...(['mssql', 'postgres'].includes(dialect) && { tableCatalog: 'sequelize_test' }),
            tableSchema: schema,
            tableName: 'actors',
            columnNames: ['level_id'],
            referencedTableSchema: schema,
            referencedTableName: 'levels',
            referencedColumnNames: ['id'],
            deleteAction: 'CASCADE',
            updateAction:
              dialect === 'mariadb' ? 'RESTRICT' : dialect === 'sqlite3' ? '' : 'NO ACTION',
            ...(sequelize.dialect.supports.constraints.deferrable && {
              deferrable: 'INITIALLY_IMMEDIATE',
            }),
          });
        });

        it('should show only foreign key constraints for the table in the default schema', async () => {
          const foreignKeys = await queryInterface.showConstraints('actors', {
            columnName: 'level_id',
            constraintType: 'FOREIGN KEY',
          });

          expect(foreignKeys).to.have.length(1);
          expect(foreignKeys[0]).to.deep.equal({
            ...(['mssql', 'postgres'].includes(dialect) && { constraintCatalog: 'sequelize_test' }),
            constraintSchema: sequelize.dialect.getDefaultSchema(),
            constraintName: 'custom_constraint_name',
            constraintType: 'FOREIGN KEY',
            ...(['mssql', 'postgres'].includes(dialect) && { tableCatalog: 'sequelize_test' }),
            tableSchema: sequelize.dialect.getDefaultSchema(),
            tableName: 'actors',
            columnNames: ['level_id'],
            referencedTableSchema: sequelize.dialect.getDefaultSchema(),
            referencedTableName: 'levels',
            referencedColumnNames: ['id'],
            deleteAction: 'CASCADE',
            updateAction:
              dialect === 'mariadb' ? 'RESTRICT' : dialect === 'sqlite3' ? '' : 'NO ACTION',
            ...(sequelize.dialect.supports.constraints.deferrable && {
              deferrable: 'INITIALLY_IMMEDIATE',
            }),
          });
        });
      });
    });
  }
});
