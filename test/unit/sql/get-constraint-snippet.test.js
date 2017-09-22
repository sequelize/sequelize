'use strict';

const Support   = require(__dirname + '/../support');
const current   = Support.sequelize;
const expectsql = Support.expectsql;
const sql = current.dialect.QueryGenerator;
const expect = require('chai').expect;

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('getConstraintSnippet', () => {
    describe('unique', () => {
      it('naming', () => {
        expectsql(sql.getConstraintSnippet('myTable', {
          name: 'unique_mytable_mycolumn',
          type: 'UNIQUE',
          fields: ['myColumn']
        }), {
          default: 'CONSTRAINT [unique_mytable_mycolumn] UNIQUE ([myColumn])'
        });
      });

      it('should create constraint name if not passed', () => {
        expectsql(sql.getConstraintSnippet('myTable', {
          type: 'UNIQUE',
          fields: ['myColumn']
        }), {
          default: 'CONSTRAINT [myTable_myColumn_uk] UNIQUE ([myColumn])'
        });
      });

      it('should work with multiple columns', () => {
        expectsql(sql.getConstraintSnippet('myTable', {
          type: 'UNIQUE',
          fields: ['myColumn1', 'myColumn2']
        }), {
          default: 'CONSTRAINT [myTable_myColumn1_myColumn2_uk] UNIQUE ([myColumn1], [myColumn2])'
        });
      });
    });

    describe('check', () => {
      it('naming', () => {
        expectsql(sql.getConstraintSnippet('myTable', {
          type: 'CHECK',
          fields: [{
            attribute: 'myColumn'
          }],
          where: {
            myColumn: ['value1', 'value2', 'value3']
          }
        }), {
          mssql: "CONSTRAINT [myTable_myColumn_ck] CHECK ([myColumn] IN (N'value1', N'value2', N'value3'))",
          default: "CONSTRAINT [myTable_myColumn_ck] CHECK ([myColumn] IN ('value1', 'value2', 'value3'))"
        });
      });

      it('where', () => {
        expectsql(sql.getConstraintSnippet('myTable', {
          type: 'CHECK',
          fields: ['myColumn'],
          name: 'check_mycolumn_where',
          where: {
            myColumn: {
              $and: {
                $gt: 50,
                $lt: 100
              }
            }
          }
        }), {
          default: 'CONSTRAINT [check_mycolumn_where] CHECK (([myColumn] > 50 AND [myColumn] < 100))'
        });
      });

    });

    describe('primary key', () => {
      it('naming', () => {
        expectsql(sql.getConstraintSnippet('myTable', {
          name: 'primary_mytable_mycolumn',
          type: 'primary key',
          fields: ['myColumn']
        }), {
          default: 'CONSTRAINT [primary_mytable_mycolumn] PRIMARY KEY ([myColumn])'
        });
      });

      it('should create constraint name if not passed', () => {
        expectsql(sql.getConstraintSnippet('myTable', {
          type: 'PRIMARY KEY',
          fields: ['myColumn']
        }), {
          default: 'CONSTRAINT [myTable_myColumn_pk] PRIMARY KEY ([myColumn])'
        });
      });

      it('should work with multiple columns', () => {
        expectsql(sql.getConstraintSnippet('myTable', {
          type: 'PRIMARY KEY',
          fields: ['myColumn1', 'myColumn2']
        }), {
          default: 'CONSTRAINT [myTable_myColumn1_myColumn2_pk] PRIMARY KEY ([myColumn1], [myColumn2])'
        });
      });
    });

    describe('foreign key', () => {
      it('naming', () => {
        expectsql(sql.getConstraintSnippet('myTable', {
          name: 'foreignkey_mytable_mycolumn',
          type: 'foreign key',
          fields: ['myColumn'],
          references: {
            table: 'myOtherTable',
            field: 'id'
          }
        }), {
          default: 'CONSTRAINT [foreignkey_mytable_mycolumn] FOREIGN KEY ([myColumn]) REFERENCES [myOtherTable] ([id])'
        });
      });

      it('uses onDelete, onUpdate', () => {
        expectsql(sql.getConstraintSnippet('myTable', {
          type: 'foreign key',
          fields: ['myColumn'],
          references: {
            table: 'myOtherTable',
            field: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        }), {
          default: 'CONSTRAINT [myTable_myColumn_myOtherTable_fk] FOREIGN KEY ([myColumn]) REFERENCES [myOtherTable] ([id]) ON UPDATE CASCADE ON DELETE CASCADE'
        });
      });

      it('errors if references object is not passed', () => {
        expect(sql.getConstraintSnippet.bind(sql, 'myTable', {
          type: 'foreign key',
          fields: ['myColumn']
        })).to.throw('references object with table and field must be specified');
      });


    });

    describe('validation', () => {
      it('throw error on invalid type', () => {
        expect(sql.getConstraintSnippet.bind(sql, 'myTable', { type: 'some type', fields: [] })).to.throw('some type is invalid');
      });
    });
  });
});
