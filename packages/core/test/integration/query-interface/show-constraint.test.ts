import { expect } from 'chai';
import { DataTypes, Op } from '@sequelize/core';
import { sequelize } from '../support';

const queryInterface = sequelize.queryInterface;
const dialect = sequelize.getDialect();

describe('QueryInterface#showConstraints', () => {
  describe('Without schema', () => {
    beforeEach(async () => {
      await queryInterface.createTable('level', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      });

      await queryInterface.createTable('actors', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
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
          references: {
            key: 'id',
            table: 'level',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
      });
    });

    it('should show constraints', async () => {
      const constraints = await queryInterface.showConstraints('actors');
      if (['postgres'].includes(dialect)) {
        // Postgres returns the not null constraint as well
        expect(constraints).to.have.length(6);
      } else {
        expect(constraints).to.have.length(2);
      }
    });

    if (sequelize.dialect.supports.constraints.check) {
      it('should show CHECK constraint', async () => {
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

        const constraints = await queryInterface.showConstraints('actors', { constraintName: 'custom_constraint_name' });
        expect(constraints).to.have.length(1);
        expect(constraints[0].constraintName).to.equal('custom_constraint_name');
        expect(constraints[0].constraintType).to.equal('CHECK');
        expect(constraints[0].definition).to.not.be.null;
      });
    }

    if (sequelize.dialect.supports.constraints.default) {
      it('should show DEFAULT constraints', async () => {
        await queryInterface.addConstraint('actors', {
          name: 'custom_constraint_name',
          type: 'DEFAULT',
          fields: ['status'],
          defaultValue: 'active',
        });

        const constraints = await queryInterface.showConstraints('actors', { constraintName: 'custom_constraint_name' });
        expect(constraints).to.have.length(1);
        expect(constraints[0].constraintName).to.equal('custom_constraint_name');
        expect(constraints[0].constraintType).to.equal('DEFAULT');
        expect(constraints[0].definition).to.not.be.null;
      });
    }

    if (sequelize.dialect.supports.constraints.unique) {
      it('should show UNIQUE constraints', async () => {

        await queryInterface.addConstraint('actors', {
          name: 'custom_constraint_name',
          type: 'UNIQUE',
          fields: ['name', 'age'],
        });

        const constraints = await queryInterface.showConstraints('actors', { constraintName: 'custom_constraint_name' });
        expect(constraints).to.have.length(1);
        expect(constraints[0].constraintName).to.equal('custom_constraint_name');
        expect(constraints[0].constraintType).to.equal('UNIQUE');
      });
    }
  });

  if (sequelize.dialect.supports.schemas) {
    describe('With schema', () => {
      beforeEach(async () => {
        await queryInterface.createSchema('archive');

        await queryInterface.createTable({
          tableName: 'level',
          schema: 'archive',
        }, {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          name: {
            type: DataTypes.STRING,
            allowNull: false,
          },
        });

        await queryInterface.createTable({
          tableName: 'actors',
          schema: 'archive',
        }, {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
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
            references: {
              key: 'id',
              table: {
                tableName: 'level',
                schema: 'archive',
              },
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        });
      });

      it('should show constraints', async () => {
        const constraints = await queryInterface.showConstraints({ tableName: 'actors', schema: 'archive' });
        if (['postgres'].includes(dialect)) {
          // Postgres returns the not null constraint as well
          expect(constraints).to.have.length(6);
        } else {
          expect(constraints).to.have.length(2);
        }
      });

      if (sequelize.dialect.supports.constraints.check) {
        it('should show CHECK constraint', async () => {
          await queryInterface.addConstraint({
            tableName: 'actors',
            schema: 'archive',
          }, {
            name: 'custom_constraint_name',
            type: 'CHECK',
            fields: ['age'],
            where: {
              age: {
                [Op.gt]: 10,
              },
            },
          });

          const constraints = await queryInterface.showConstraints({ tableName: 'actors', schema: 'archive' }, { constraintName: 'custom_constraint_name' });
          expect(constraints).to.have.length(1);
          expect(constraints[0].constraintName).to.equal('custom_constraint_name');
          expect(constraints[0].constraintType).to.equal('CHECK');
          expect(constraints[0].definition).to.not.be.null;
        });
      }

      if (sequelize.dialect.supports.constraints.default) {
        it('should show DEFAULT constraints', async () => {
          await queryInterface.addConstraint({
            tableName: 'actors',
            schema: 'archive',
          }, {
            name: 'custom_constraint_name',
            type: 'DEFAULT',
            fields: ['status'],
            defaultValue: 'active',
          });

          const constraints = await queryInterface.showConstraints({ tableName: 'actors', schema: 'archive' }, { constraintName: 'custom_constraint_name' });
          expect(constraints).to.have.length(1);
          expect(constraints[0].constraintName).to.equal('custom_constraint_name');
          expect(constraints[0].constraintType).to.equal('DEFAULT');
          expect(constraints[0].definition).to.not.be.null;
        });
      }

      if (sequelize.dialect.supports.constraints.unique) {
        it('should show UNIQUE constraints', async () => {
          await queryInterface.addConstraint({
            tableName: 'actors',
            schema: 'archive',
          }, {
            name: 'custom_constraint_name',
            type: 'UNIQUE',
            fields: ['name', 'age'],
          });

          const constraints = await queryInterface.showConstraints({ tableName: 'actors', schema: 'archive' }, { constraintName: 'custom_constraint_name' });
          expect(constraints).to.have.length(1);
          expect(constraints[0].constraintName).to.equal('custom_constraint_name');
          expect(constraints[0].constraintType).to.equal('UNIQUE');
        });
      }
    });
  }
});
