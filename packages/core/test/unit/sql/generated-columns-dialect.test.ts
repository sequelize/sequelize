import { DataTypes, sql } from '@sequelize/core';
import { expect } from 'chai';
import { getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

function generatedAttribute(overrides: Record<string, unknown> = {}) {
  return {
    type: sequelize.normalizeDataType(DataTypes.INTEGER),
    generatedAs: sql.literal('source + 1'),
    generatedColumn: 'STORED',
    ...overrides,
  };
}

describe('generated columns dialect edge cases', () => {
  if (dialectName === 'postgres') {
    it('formats database function expressions', () => {
      const FunctionExpressionModel = sequelize.define(
        'GeneratedFunctionExpression',
        {
          sourceValue: {
            type: DataTypes.INTEGER,
            columnName: 'source_value',
          },
        },
        { timestamps: false },
      );
      const definition = sequelize.queryGenerator.attributeToSQL(
        generatedAttribute({
          generatedAs: sql.fn('resolve_parent_id', sql.attribute('sourceValue')),
        }),
        { model: FunctionExpressionModel },
      );

      expect(definition).to.include('resolve_parent_id("source_value")');
    });

    it('requires PostgreSQL 12 and preserves generated foreign keys', () => {
      expect(sequelize.dialect.minimumDatabaseVersion).to.equal('12.0.0');

      const definition = sequelize.queryGenerator.attributeToSQL(
        generatedAttribute({ references: { table: 'parents', key: 'id' } }),
        {},
      );

      expect(definition).to.include('REFERENCES "parents" ("id")');
    });
  }

  if (dialectName === 'mysql') {
    it('orders nullability correctly and validates primary keys', () => {
      const definition = sequelize.queryGenerator.attributeToSQL(
        generatedAttribute({ allowNull: false }),
      );

      expect(definition).to.equal('INTEGER GENERATED ALWAYS AS (source + 1) STORED NOT NULL');
      expect(() =>
        sequelize.queryGenerator.attributeToSQL(
          generatedAttribute({ generatedColumn: 'VIRTUAL', primaryKey: true }),
        ),
      ).to.throw(/does not support VIRTUAL generated columns as primary keys/);
    });

    it('preserves supported generated foreign keys', () => {
      const definition = sequelize.queryGenerator.attributeToSQL(
        generatedAttribute({
          references: { table: 'parents', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'NO ACTION',
        }),
      );

      expect(definition).to.include(
        'REFERENCES `parents` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
      );
    });
  }

  if (dialectName === 'mariadb') {
    it('rejects unsupported nullability and primary keys', () => {
      expect(() =>
        sequelize.queryGenerator.attributeToSQL(generatedAttribute({ allowNull: false })),
      ).to.throw(/does not support NOT NULL on generated columns/);
      expect(() =>
        sequelize.queryGenerator.attributeToSQL(generatedAttribute({ primaryKey: true })),
      ).to.throw(/does not support generated columns as primary keys/);
    });

    it('preserves supported generated foreign keys', () => {
      const definition = sequelize.queryGenerator.attributeToSQL(
        generatedAttribute({
          references: { table: 'parents', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'NO ACTION',
        }),
      );

      expect(definition).to.include(
        'REFERENCES `parents` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
      );
    });
  }

  if (dialectName === 'db2' || dialectName === 'ibmi') {
    it('preserves generated foreign keys', () => {
      const definition = sequelize.queryGenerator.attributeToSQL(
        generatedAttribute({ references: { table: 'parents', key: 'id' } }),
        {},
      );

      expect(definition).to.include('REFERENCES "parents" ("id")');
    });
  }

  if (dialectName === 'mssql') {
    it('rejects unsupported computed foreign-key actions', () => {
      expect(() =>
        sequelize.queryGenerator.attributeToSQL(
          generatedAttribute({
            references: { table: 'parents', key: 'id' },
            onUpdate: 'CASCADE',
          }),
        ),
      ).to.throw(/does not support ON UPDATE CASCADE on generated columns/);
    });
  }
});
