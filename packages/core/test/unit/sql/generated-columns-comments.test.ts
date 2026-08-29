import { DataTypes, sql } from '@sequelize/core';
import { expect } from 'chai';
import { getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

describe('generated column comments', () => {
  if (dialectName === 'mssql') {
    it('preserves generated column comments in createTable SQL', () => {
      const definition = sequelize.queryGenerator.attributeToSQL({
        type: sequelize.normalizeDataType(DataTypes.INTEGER),
        generatedAs: sql.literal('[source] + 1'),
        generatedColumn: 'STORED',
        comment: 'computed total',
      });
      const ddl = sequelize.queryGenerator.createTableQuery('generated_comments', {
        computed: definition,
      });

      expect(ddl).to.include('AS (CAST([source] + 1 AS INTEGER)) PERSISTED');
      expect(ddl).to.include("sp_addextendedproperty @name = N'MS_Description'");
      expect(ddl).to.include("@value = N'computed total'");
    });
  }

  if (dialectName === 'mssql' || dialectName === 'db2') {
    it('preserves COMMENT keywords in generated column comments', () => {
      const definition = sequelize.queryGenerator.attributeToSQL({
        type: sequelize.normalizeDataType(DataTypes.INTEGER),
        generatedAs: sql.literal(dialectName === 'mssql' ? '[source] + 1' : '"source" + 1'),
        generatedColumn: 'STORED',
        comment: 'before COMMENT after',
      });
      const ddl = sequelize.queryGenerator.createTableQuery('generated_comment_keywords', {
        computed: definition,
      });

      expect(ddl).not.to.match(/(?:PERSISTED|\)) COMMENT before/);
      if (dialectName === 'mssql') {
        expect(ddl).to.include("@value = N'before COMMENT after'");
      } else {
        expect(ddl).to.include("-- 'before COMMENT after'");
      }
    });
  }
});
