import { createSequelizeInstance, expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();
const notSupportedError = new Error(
  `removeTemporalTableQuery has not been implemented in ${dialectName}.`,
);

describe('QueryGenerator#removeTemporalTableQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a removeTemporalTableQuery query', () => {
    expectsql(() => queryGenerator.removeTemporalTableQuery('myTable'), {
      default: notSupportedError,
    });
  });

  it('produces a removeTemporalTableQuery query for a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.removeTemporalTableQuery(MyModel), {
      default: notSupportedError,
    });
  });

  it('produces a removeTemporalTableQuery query for a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.removeTemporalTableQuery(MyModel.modelDefinition), {
      default: notSupportedError,
    });
  });

  it('produces a removeTemporalTableQuery query with a custom schema', () => {
    expectsql(
      () => queryGenerator.removeTemporalTableQuery({ tableName: 'myTable', schema: 'mySchema' }),
      {
        default: notSupportedError,
      },
    );
  });

  it('produces a removeTemporalTableQuery query with a default schema', () => {
    expectsql(
      () =>
        queryGenerator.removeTemporalTableQuery({
          tableName: 'myTable',
          schema: sequelize.dialect.getDefaultSchema(),
        }),
      {
        default: notSupportedError,
      },
    );
  });

  it('produces a removeTemporalTableQuery query with globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(() => queryGeneratorSchema.removeTemporalTableQuery('myTable'), {
      default: notSupportedError,
    });
  });
});
