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
  if (
    sequelize.dialect.supports.generatedColumns.stored ||
    sequelize.dialect.supports.generatedColumns.virtual
  ) {
    it('does not parse constraint keywords inside generated expressions', () => {
      const attributes = sequelize.queryGenerator.attributesToSQL(
        {
          computed: generatedAttribute({
            type: sequelize.normalizeDataType(DataTypes.STRING),
            generatedAs: sql.literal("'PRIMARY KEY REFERENCES COMMENT )'"),
            generatedColumn: sequelize.dialect.supports.generatedColumns.stored
              ? 'STORED'
              : 'VIRTUAL',
          }),
        },
        { context: 'createTable' },
      );
      const definition = attributes.computed;
      const ddl = sequelize.queryGenerator.createTableQuery(
        'generated_keyword_test',
        attributes,
        {},
      );
      const ddlForAssertion = dialectName === 'oracle' ? ddl.replaceAll("''", "'") : ddl;

      expect(ddlForAssertion).to.include(
        `${sequelize.queryGenerator.quoteIdentifier('computed')} ${definition}`,
      );

      const ddlWithoutGeneratedDefinition = ddlForAssertion.replace(definition, '');
      expect(ddlWithoutGeneratedDefinition).not.to.include('PRIMARY KEY');
      expect(ddlWithoutGeneratedDefinition).not.to.include('REFERENCES');
      expect(ddlWithoutGeneratedDefinition).not.to.include('COMMENT');
    });
  }

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

    it('preserves generated foreign keys', () => {
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

  if (dialectName === 'mysql' || dialectName === 'mariadb') {
    it('ignores constraint keywords in hash comments inside generated expressions', () => {
      const definition = sequelize.queryGenerator.attributeToSQL(
        generatedAttribute({
          generatedAs: sql.literal('source + # ) PRIMARY KEY REFERENCES COMMENT\n 1'),
        }),
      );
      const ddl = sequelize.queryGenerator.createTableQuery('generated_hash_comment', {
        computed: definition,
      });

      expect(ddl).to.include(
        `${sequelize.queryGenerator.quoteIdentifier('computed')} ${definition}`,
      );
      expect(ddl.replace(definition, '')).not.to.include('PRIMARY KEY');
      expect(ddl.replace(definition, '')).not.to.include('REFERENCES');
    });

    it('does not treat two minus operators as a line comment', () => {
      const definition = sequelize.queryGenerator.attributeToSQL(
        generatedAttribute({
          generatedAs: sql.literal('source--1'),
          references: { table: 'parents', key: 'id' },
        }),
      );
      const ddl = sequelize.queryGenerator.createTableQuery('generated_double_minus', {
        computed: definition,
      });

      expect(ddl).to.include('GENERATED ALWAYS AS (source--1) STORED');
      expect(ddl).to.include(
        `FOREIGN KEY (${sequelize.queryGenerator.quoteIdentifier('computed')})`,
      );
    });

    it('preserves backslash-escaped quotes in double-quoted regions', () => {
      const definition = sequelize.queryGenerator.attributeToSQL(
        generatedAttribute({
          generatedAs: sql.literal('"value\\") PRIMARY KEY"'),
        }),
      );
      const ddl = sequelize.queryGenerator.createTableQuery('generated_double_quote', {
        computed: definition,
      });

      expect(ddl).to.include(
        `${sequelize.queryGenerator.quoteIdentifier('computed')} ${definition}`,
      );
      expect(ddl.replace(definition, '')).not.to.include('PRIMARY KEY');
    });
  }

  if (dialectName === 'mysql' || dialectName === 'mariadb' || dialectName === 'mssql') {
    it('preserves doubled quotes in double-quoted SQL regions', () => {
      const closeParentheses = dialectName === 'mssql' ? '))' : ')';
      const definition = sequelize.queryGenerator.attributeToSQL(
        generatedAttribute({
          type: sequelize.normalizeDataType(DataTypes.STRING),
          generatedAs: sql.literal(`"value""${closeParentheses} PRIMARY KEY"`),
        }),
      );
      const ddl = sequelize.queryGenerator.createTableQuery('generated_double_quote', {
        computed: definition,
      });

      expect(ddl).to.include(
        `${sequelize.queryGenerator.quoteIdentifier('computed')} ${definition}`,
      );
      expect(ddl.replace(definition, '')).not.to.include('PRIMARY KEY');
    });
  }

  if (dialectName === 'sqlite3') {
    for (const expression of ['"value) PRIMARY KEY"', '[value) PRIMARY KEY]']) {
      it(`preserves SQLite quoted regions in generated expressions: ${expression}`, () => {
        const attributes = sequelize.queryGenerator.attributesToSQL(
          {
            computed: generatedAttribute({ generatedAs: sql.literal(expression) }),
          },
          { context: 'createTable' },
        );
        const definition = attributes.computed;
        const ddl = sequelize.queryGenerator.createTableQuery(
          'generated_quoted_region',
          attributes,
        );

        expect(ddl).to.include(
          `${sequelize.queryGenerator.quoteIdentifier('computed')} ${definition}`,
        );
        expect(ddl.replace(definition, '')).not.to.include('PRIMARY KEY');
      });
    }
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
