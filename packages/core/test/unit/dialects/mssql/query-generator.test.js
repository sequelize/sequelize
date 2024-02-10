'use strict';

const Support = require('../../../support');

const expectsql = Support.expectsql;
const current = Support.sequelize;
const { DataTypes, Op } = require('@sequelize/core');
const { MsSqlQueryGenerator: QueryGenerator } = require('@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/mssql/query-generator.js');

if (current.dialect.name === 'mssql') {
  describe('[MSSQL Specific] QueryGenerator', () => {
    before(function () {
      this.queryGenerator = new QueryGenerator(this.sequelize.dialect);
    });

    it('upsertQuery with falsey values', function () {
      const testTable = this.sequelize.define(
        'test_table',
        {
          Name: {
            type: DataTypes.STRING,
            primaryKey: true,
          },
          Age: {
            type: DataTypes.INTEGER,
          },
          IsOnline: {
            type: DataTypes.BOOLEAN,
            primaryKey: true,
          },
        },
        {
          freezeTableName: true,
          timestamps: false,
        },
      );

      const insertValues = {
        Name: 'Charlie',
        Age: 24,
        IsOnline: false,
      };

      const updateValues = {
        Age: 24,
      };

      const whereValues = [
        {
          Name: 'Charlie',
          IsOnline: false,
        },
      ];

      const where = {
        [Op.or]: whereValues,
      };

      // the main purpose of this test is to validate this does not throw
      expectsql(this.queryGenerator.upsertQuery('test_table', updateValues, insertValues, where, testTable), {
        mssql:
          'MERGE INTO [test_table] WITH(HOLDLOCK) AS [test_table_target] USING (VALUES(24)) AS [test_table_source]([Age]) ON [test_table_target].[Name] = [test_table_source].[Name] AND [test_table_target].[IsOnline] = [test_table_source].[IsOnline] WHEN MATCHED THEN UPDATE SET [test_table_target].[Name] = N\'Charlie\', [test_table_target].[Age] = 24, [test_table_target].[IsOnline] = 0 WHEN NOT MATCHED THEN INSERT ([Age]) VALUES(24) OUTPUT $action, INSERTED.*;',
      });
    });

    it('addColumnQuery', function () {
      expectsql(this.queryGenerator.addColumnQuery('myTable', 'myColumn', { type: 'VARCHAR(255)' }), {
        mssql: 'ALTER TABLE [myTable] ADD [myColumn] VARCHAR(255) NULL;',
      });
    });

    it('addColumnQuery with comment', function () {
      expectsql(this.queryGenerator.addColumnQuery('myTable', 'myColumn', { type: 'VARCHAR(255)', comment: 'This is a comment' }), {
        mssql: 'ALTER TABLE [myTable] ADD [myColumn] VARCHAR(255) NULL; EXEC sp_addextendedproperty '
          + '@name = N\'MS_Description\', @value = N\'This is a comment\', '
          + '@level0type = N\'Schema\', @level0name = N\'dbo\', '
          + '@level1type = N\'Table\', @level1name = [myTable], '
          + '@level2type = N\'Column\', @level2name = [myColumn];',
      });
    });
  });
}
