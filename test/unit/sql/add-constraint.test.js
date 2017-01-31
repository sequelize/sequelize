'use strict';

/* jshint -W030, -W110 */
const Support   = require(__dirname + '/../support');
const current   = Support.sequelize;
const expectsql = Support.expectsql;
const sql = current.dialect.QueryGenerator;
const expect = require('chai').expect;

if (current.dialect.supports.constraints.addConstraint) {
  describe(Support.getTestDialectTeaser('SQL'), function() {
    describe('addConstraint', function() {
      describe('unique', function() {
        it('naming', function() {
          expectsql(sql.addConstraintQuery('myTable', {
            name: 'unique_mytable_mycolumn',
            type: 'UNIQUE',
            fields: ['myColumn']
          }), {
            default: 'ALTER TABLE [myTable] ADD CONSTRAINT [unique_mytable_mycolumn] UNIQUE ([myColumn]);'
          });
        });

        it('should create constraint name if not passed', function() {
          expectsql(sql.addConstraintQuery('myTable', {
            type: 'UNIQUE',
            fields: ['myColumn']
          }), {
            default: 'ALTER TABLE [myTable] ADD CONSTRAINT [UK__myTable__myColumn] UNIQUE ([myColumn]);'
          });
        });

        it('should work with multiple columns', function() {
          expectsql(sql.addConstraintQuery('myTable', {
            type: 'UNIQUE',
            fields: ['myColumn1', 'myColumn2']
          }), {
            default: 'ALTER TABLE [myTable] ADD CONSTRAINT [UK__myTable__myColumn1_myColumn2] UNIQUE ([myColumn1], [myColumn2]);'
          });
        }); 
      });
      
      describe('check', function() {
        it('naming', function() {
          expectsql(sql.addConstraintQuery('myTable', {
            type: 'CHECK',
            fields: ['myColumn'],
            where: {
              myColumn: ['value1', 'value2', 'value3']
            }
          }), {
            mssql: "ALTER TABLE [myTable] ADD CONSTRAINT [CK__myTable__myColumn] CHECK ([myColumn] IN (N'value1', N'value2', N'value3'));",
            default: "ALTER TABLE [myTable] ADD CONSTRAINT [CK__myTable__myColumn] CHECK ([myColumn] IN ('value1', 'value2', 'value3'));"
          });
        });

        it('where', function() {
          expectsql(sql.addConstraintQuery('myTable', {
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
            default: 'ALTER TABLE [myTable] ADD CONSTRAINT [check_mycolumn_where] CHECK (([myColumn] > 50 AND [myColumn] < 100));'
          });
        });
        
      });

      if(current.dialect.supports.constraints.default) {
        describe('default', function() {
          it('naming', function() {
            expectsql(sql.addConstraintQuery('myTable', {
              type: 'default',
              fields: ['myColumn'],
              defaultValue: 0
            }), {
              mssql: 'ALTER TABLE [myTable] ADD CONSTRAINT [DF__myTable__myColumn] DEFAULT (0) FOR [myColumn];'
            });
          });

          it('string', function() {
            expectsql(sql.addConstraintQuery('myTable', {
              type: 'default',
              fields: ['myColumn'],
              defaultValue: 'some default value',
              name: 'default_mytable_null'
            }), {
              mssql: "ALTER TABLE [myTable] ADD CONSTRAINT [default_mytable_null] DEFAULT (N'some default value') FOR [myColumn];"
            });
          });
        });
      }
      describe('primary key', function() {
        it('naming', function() {
          expectsql(sql.addConstraintQuery('myTable', {
            name: 'primary_mytable_mycolumn',
            type: 'primary key',
            fields: ['myColumn']
          }), {
            default: 'ALTER TABLE [myTable] ADD CONSTRAINT [primary_mytable_mycolumn] PRIMARY KEY ([myColumn]);'
          });
        });

        it('should create constraint name if not passed', function() {
          expectsql(sql.addConstraintQuery('myTable', {
            type: 'PRIMARY KEY',
            fields: ['myColumn']
          }), {
            default: 'ALTER TABLE [myTable] ADD CONSTRAINT [PK__myTable__myColumn] PRIMARY KEY ([myColumn]);'
          });
        });

        it('should work with multiple columns', function() {
          expectsql(sql.addConstraintQuery('myTable', {
            type: 'PRIMARY KEY',
            fields: ['myColumn1', 'myColumn2']
          }), {
            default: 'ALTER TABLE [myTable] ADD CONSTRAINT [PK__myTable__myColumn1_myColumn2] PRIMARY KEY ([myColumn1], [myColumn2]);'
          });
        }); 
      });

      describe('foreign key', function() {
        it('naming', function() {
          expectsql(sql.addConstraintQuery('myTable', {
            name: 'foreignkey_mytable_mycolumn',
            type: 'foreign key',
            fields: ['myColumn'],
            references: {
              model: 'myOtherTable',
              key: 'id'
            }
          }), {
            default: 'ALTER TABLE [myTable] ADD CONSTRAINT [foreignkey_mytable_mycolumn] FOREIGN KEY ([myColumn]) REFERENCES [myOtherTable] ([id]);'
          });
        });
        
        it('uses onDelete, onUpdate', function() {
          expectsql(sql.addConstraintQuery('myTable', {
            type: 'foreign key',
            fields: ['myColumn'],
            references: {
              model: 'myOtherTable',
              key: 'id'           
            },
            onUpdate: 'cascade',
            onDelete: 'cascade'
          }), {
            default: 'ALTER TABLE [myTable] ADD CONSTRAINT [FK__myTable__myColumn__myOtherTable] FOREIGN KEY ([myColumn]) REFERENCES [myOtherTable] ([id]) ON UPDATE CASCADE ON DELETE CASCADE;'
          });
        });
        
        it('errors if references object is not passed', function() {
          expect(sql.addConstraintQuery.bind(sql, 'myTable', {
            type: 'foreign key',
            fields: ['myColumn']
          })).to.throw('references object with model and key must be specified');
        });
        
        
      });
      
      describe('validation', function() {
        it('throw error on invalid type', function () {
          expect(sql.addConstraintQuery.bind(sql, 'myTable', { type: 'some type', fields: [] })).to.throw('some type is invalid');
        });
      });
    });
  });
}
