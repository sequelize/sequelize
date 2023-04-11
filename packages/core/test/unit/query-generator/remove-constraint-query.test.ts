import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('QueryGenerator#removeConstraintQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('generates a query that drops a constraint', () => {
    expectsql(() => queryGenerator.removeConstraintQuery('myTable', 'myConstraint'), {
      default: 'ALTER TABLE [myTable] DROP CONSTRAINT [myConstraint]',
    });
  });

  it('generates a query that drops a column from a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.removeConstraintQuery(MyModel, 'myConstraint'), {
      default: 'ALTER TABLE [MyModels] DROP CONSTRAINT [myConstraint]',
    });
  });

  it('generates a query that drops a column with schema', () => {
    expectsql(() => queryGenerator.removeConstraintQuery({ tableName: 'myTable', schema: 'mySchema' }, 'myConstraint'), {
      default: 'ALTER TABLE [mySchema].[myTable] DROP CONSTRAINT [myConstraint]',
      sqlite: 'ALTER TABLE `mySchema.myTable` DROP CONSTRAINT `myConstraint`',
    });
  });

  it('generates a query that drops a column with default schema', () => {
    expectsql(() => queryGenerator.removeConstraintQuery({ tableName: 'myTable', schema: dialect.getDefaultSchema() }, 'myConstraint'), {
      default: 'ALTER TABLE [myTable] DROP CONSTRAINT [myConstraint]',
    });
  });

  it('generates a query that drops a column from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.getQueryInterface().queryGenerator;

    expectsql(() => queryGeneratorSchema.removeConstraintQuery('myTable', 'myConstraint'), {
      default: 'ALTER TABLE [mySchema].[myTable] DROP CONSTRAINT [myConstraint]',
      sqlite: 'ALTER TABLE `mySchema.myTable` DROP CONSTRAINT `myConstraint`',
    });
  });

  it('generates a query that drops a column with schema and custom delimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(() => queryGenerator.removeConstraintQuery({ tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' }, 'myConstraint'), {
      sqlite: 'ALTER TABLE `mySchemacustommyTable` DROP CONSTRAINT `myConstraint`',
    });
  });
});
