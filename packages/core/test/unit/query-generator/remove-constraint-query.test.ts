import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const notSupportedError = new Error(`Remove constraint queries are not supported by ${dialect.name} dialect`);

describe('QueryGenerator#removeConstraintQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('generates a query that drops a constraint', () => {
    expectsql(() => queryGenerator.removeConstraintQuery('myTable', 'myConstraint'), {
      default: 'ALTER TABLE [myTable] DROP CONSTRAINT [myConstraint]',
      'mysql sqlite': notSupportedError,
    });
  });

  it('generates a query that drops a constraint with IF EXISTS', () => {
    expectsql(() => queryGenerator.removeConstraintQuery('myTable', 'myConstraint', { ifExists: true }), {
      default: 'ALTER TABLE [myTable] DROP CONSTRAINT IF EXISTS [myConstraint]',
      'db2 ibmi snowflake': buildInvalidOptionReceivedError('removeConstraintQuery', dialect.name, ['ifExists']),
      'mysql sqlite': notSupportedError,
    });
  });

  it('generates a query that drops a constraint with CASCADE', () => {
    expectsql(() => queryGenerator.removeConstraintQuery('myTable', 'myConstraint', { cascade: true }), {
      default: 'ALTER TABLE [myTable] DROP CONSTRAINT [myConstraint] CASCADE',
      'db2 ibmi mariadb mssql': buildInvalidOptionReceivedError('removeConstraintQuery', dialect.name, ['cascade']),
      'mysql sqlite': notSupportedError,
    });
  });

  it('generates a query that drops a constraint with IF EXISTS and CASCADE', () => {
    expectsql(() => queryGenerator.removeConstraintQuery('myTable', 'myConstraint', { cascade: true, ifExists: true }), {
      default: 'ALTER TABLE [myTable] DROP CONSTRAINT IF EXISTS [myConstraint] CASCADE',
      snowflake: buildInvalidOptionReceivedError('removeConstraintQuery', dialect.name, ['ifExists']),
      'db2 ibmi mariadb mssql': buildInvalidOptionReceivedError('removeConstraintQuery', dialect.name, ['cascade']),
      'mysql sqlite': notSupportedError,
    });
  });

  it('generates a query that drops a constraint from a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.removeConstraintQuery(MyModel, 'myConstraint'), {
      default: 'ALTER TABLE [MyModels] DROP CONSTRAINT [myConstraint]',
      'mysql sqlite': notSupportedError,
    });
  });

  it('generates a query that drops a constraint with schema', () => {
    expectsql(() => queryGenerator.removeConstraintQuery({ tableName: 'myTable', schema: 'mySchema' }, 'myConstraint'), {
      default: 'ALTER TABLE [mySchema].[myTable] DROP CONSTRAINT [myConstraint]',
      'mysql sqlite': notSupportedError,
    });
  });

  it('generates a query that drops a constraint with default schema', () => {
    expectsql(() => queryGenerator.removeConstraintQuery({ tableName: 'myTable', schema: dialect.getDefaultSchema() }, 'myConstraint'), {
      default: 'ALTER TABLE [myTable] DROP CONSTRAINT [myConstraint]',
      'mysql sqlite': notSupportedError,
    });
  });

  it('generates a query that drops a constraint from a table and globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(() => queryGeneratorSchema.removeConstraintQuery('myTable', 'myConstraint'), {
      default: 'ALTER TABLE [mySchema].[myTable] DROP CONSTRAINT [myConstraint]',
      'mysql sqlite': notSupportedError,
    });
  });

  it('generates a query that drops a column with schema and custom delimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(() => queryGenerator.removeConstraintQuery({ tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' }, 'myConstraint'), {
      sqlite: notSupportedError,
    });
  });
});
