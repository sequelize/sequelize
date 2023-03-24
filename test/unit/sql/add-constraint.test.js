'use strict';

const Support = require('../support');
const current = Support.sequelize;
const expectsql = Support.expectsql;
const sql = current.dialect.queryGenerator;
const Op = Support.Sequelize.Op;
const expect = require('chai').expect;
const sinon = require('sinon');

if (current.dialect.supports.constraints.addConstraint) {
  describe(Support.getTestDialectTeaser('SQL'), () => {
    describe('addConstraint', () => {
      describe('unique', () => {
        it('naming', () => {
          expectsql(sql.addConstraintQuery('myTable', {
            name: 'unique_mytable_mycolumn',
            type: 'UNIQUE',
            fields: ['myColumn']
          }), {
            default: 'ALTER TABLE [myTable] ADD CONSTRAINT [unique_mytable_mycolumn] UNIQUE ([myColumn]);'
          });
        });

        it('should create constraint name if not passed', () => {
          expectsql(sql.addConstraintQuery('myTable', {
            type: 'UNIQUE',
            fields: ['myColumn']
          }), {
            default: 'ALTER TABLE [myTable] ADD CONSTRAINT [myTable_myColumn_uk] UNIQUE ([myColumn]);'
          });
        });

        it('should work with multiple columns', () => {
          expectsql(sql.addConstraintQuery('myTable', {
            type: 'UNIQUE',
            fields: ['myColumn1', 'myColumn2']
          }), {
            default: 'ALTER TABLE [myTable] ADD CONSTRAINT [myTable_myColumn1_myColumn2_uk] UNIQUE ([myColumn1], [myColumn2]);'
          });
        });
      });

      describe('check', () => {
        it('naming', () => {
          expectsql(sql.addConstraintQuery('myTable', {
            type: 'CHECK',
            fields: ['myColumn'],
            where: {
              myColumn: ['value1', 'value2', 'value3']
            }
          }), {
            mssql: "ALTER TABLE [myTable] ADD CONSTRAINT [myTable_myColumn_ck] CHECK ([myColumn] IN (N'value1', N'value2', N'value3'));",
            default: "ALTER TABLE [myTable] ADD CONSTRAINT [myTable_myColumn_ck] CHECK ([myColumn] IN ('value1', 'value2', 'value3'));"
          });
        });

        it('where', () => {
          expectsql(sql.addConstraintQuery('myTable', {
            type: 'CHECK',
            fields: ['myColumn'],
            name: 'check_mycolumn_where',
            where: {
              myColumn: {
                [Op.and]: {
                  [Op.gt]: 50,
                  [Op.lt]: 100
                }
              }
            }
          }), {
            default: 'ALTER TABLE [myTable] ADD CONSTRAINT [check_mycolumn_where] CHECK (([myColumn] > 50 AND [myColumn] < 100));'
          });
        });

      });

      if (current.dialect.supports.constraints.default) {
        describe('default', () => {
          it('naming', () => {
            expectsql(sql.addConstraintQuery('myTable', {
              type: 'default',
              fields: ['myColumn'],
              defaultValue: 0
            }), {
              mssql: 'ALTER TABLE [myTable] ADD CONSTRAINT [myTable_myColumn_df] DEFAULT (0) FOR [myColumn];'
            });
          });

          it('string', () => {
            expectsql(sql.addConstraintQuery('myTable', {
              type: 'default',
              fields: ['myColumn'],
              defaultValue: 'some default value',
              name: 'default_mytable_null'
            }), {
              mssql: "ALTER TABLE [myTable] ADD CONSTRAINT [default_mytable_null] DEFAULT (N'some default value') FOR [myColumn];"
            });
          });

          it('validation', () => {
            expect(sql.addConstraintQuery.bind(sql, {
              tableName: 'myTable',
              schema: 'mySchema'
            }, {
              type: 'default',
              fields: [{
                attribute: 'myColumn'
              }]
            })).to.throw('Default value must be specified for DEFAULT CONSTRAINT');
          });
        });
      }
      describe('primary key', () => {
        it('naming', () => {
          expectsql(sql.addConstraintQuery('myTable', {
            name: 'primary_mytable_mycolumn',
            type: 'primary key',
            fields: ['myColumn']
          }), {
            default: 'ALTER TABLE [myTable] ADD CONSTRAINT [primary_mytable_mycolumn] PRIMARY KEY ([myColumn]);'
          });
        });

        it('should create constraint name if not passed', () => {
          expectsql(sql.addConstraintQuery('myTable', {
            type: 'PRIMARY KEY',
            fields: ['myColumn']
          }), {
            default: 'ALTER TABLE [myTable] ADD CONSTRAINT [myTable_myColumn_pk] PRIMARY KEY ([myColumn]);'
          });
        });

        it('should work with multiple columns', () => {
          expectsql(sql.addConstraintQuery('myTable', {
            type: 'PRIMARY KEY',
            fields: ['myColumn1', 'myColumn2']
          }), {
            default: 'ALTER TABLE [myTable] ADD CONSTRAINT [myTable_myColumn1_myColumn2_pk] PRIMARY KEY ([myColumn1], [myColumn2]);'
          });
        });
      });

      describe('foreign key', () => {
        it('naming', () => {
          expectsql(sql.addConstraintQuery('myTable', {
            name: 'foreignkey_mytable_mycolumn',
            type: 'foreign key',
            fields: ['myColumn'],
            references: {
              table: 'myOtherTable',
              field: 'id'
            }
          }), {
            default: 'ALTER TABLE [myTable] ADD CONSTRAINT [foreignkey_mytable_mycolumn] FOREIGN KEY ([myColumn]) REFERENCES [myOtherTable] ([id]);'
          });
        });

        // The Oracle dialect doesn't support onUpdate cascade
        (current.dialect.name !== 'oracle' ? it : it.skip)('supports composite keys', () => {
          expectsql(
            sql.addConstraintQuery('myTable', {
              type: 'foreign key',
              fields: ['myColumn', 'anotherColumn'],
              references: {
                table: 'myOtherTable',
                fields: ['id1', 'id2']
              },
              onUpdate: 'cascade',
              onDelete: 'cascade'
            }),
            {
              db2: 'ALTER TABLE "myTable" ADD CONSTRAINT "myTable_myColumn_anotherColumn_myOtherTable_fk" FOREIGN KEY ("myColumn", "anotherColumn") REFERENCES "myOtherTable" ("id1", "id2") ON DELETE CASCADE;',
              default:
                'ALTER TABLE [myTable] ADD CONSTRAINT [myTable_myColumn_anotherColumn_myOtherTable_fk] FOREIGN KEY ([myColumn], [anotherColumn]) REFERENCES [myOtherTable] ([id1], [id2]) ON UPDATE CASCADE ON DELETE CASCADE;'
            }
          );
        });
        // The Oracle dialect doesn't support onUpdate cascade
        (current.dialect.name !== 'oracle' ? it : it.skip)('uses onDelete, onUpdate', () => {
          expectsql(sql.addConstraintQuery('myTable', {
            type: 'foreign key',
            fields: ['myColumn'],
            references: {
              table: 'myOtherTable',
              field: 'id'
            },
            onUpdate: 'cascade',
            onDelete: 'cascade'
          }), {
            db2: 'ALTER TABLE "myTable" ADD CONSTRAINT "myTable_myColumn_myOtherTable_fk" FOREIGN KEY ("myColumn") REFERENCES "myOtherTable" ("id") ON DELETE CASCADE;',
            default: 'ALTER TABLE [myTable] ADD CONSTRAINT [myTable_myColumn_myOtherTable_fk] FOREIGN KEY ([myColumn]) REFERENCES [myOtherTable] ([id]) ON UPDATE CASCADE ON DELETE CASCADE;'
          });
        });

        it('errors if references object is not passed', () => {
          expect(sql.addConstraintQuery.bind(sql, 'myTable', {
            type: 'foreign key',
            fields: ['myColumn']
          })).to.throw('references object with table and field must be specified');
        });


      });

      describe('validation', () => {
        it('throw error on invalid type', () => {
          expect(sql.addConstraintQuery.bind(sql, 'myTable', { type: 'some type', fields: [] })).to.throw('some type is invalid');
        });

        it('calls getConstraintSnippet function', () => {
          const options = { type: 'unique', fields: ['myColumn'] };
          const addConstraintQuerySpy = sinon.stub(sql, 'addConstraintQuery');
          sql.addConstraintQuery('myTable', options);
          expect(sql.addConstraintQuery).to.have.been.calledWith('myTable', options);
          addConstraintQuerySpy.restore();
        });

        if (!current.dialect.supports.constraints.default) {
          it('should throw error if default constraints are used in other dialects', () => {
            expect(sql.addConstraintQuery.bind(sql, 'myTable', { type: 'default', defaultValue: 0, fields: [] })).to.throw('Default constraints are supported only for MSSQL dialect.');
          });
        }
      });
    });
  });
}
