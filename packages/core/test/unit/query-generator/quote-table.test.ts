import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const defaultSchema = dialect.getDefaultSchema();

describe('QueryGenerator#quoteTable', () => {
  if (!dialect.supports.schemas) {
    return;
  }

  it('omits a default schema that was specified explicitly', () => {
    expectsql(
      sequelize.queryGenerator.quoteTable({ tableName: 'myTable', schema: defaultSchema }),
      {
        default: '[myTable]',
      },
    );
  });

  describe('with keepExplicitDefaultSchema', () => {
    const sequelizeKeep = createSequelizeInstance({ keepExplicitDefaultSchema: true });
    const queryGenerator = sequelizeKeep.queryGenerator;
    const qualifiedTable = defaultSchema ? `[${defaultSchema}].[myTable]` : '[myTable]';

    it('keeps a default schema that was specified explicitly', () => {
      expectsql(queryGenerator.quoteTable({ tableName: 'myTable', schema: defaultSchema }), {
        default: qualifiedTable,
      });
    });

    it('omits the schema of a table that does not specify one', () => {
      expectsql(queryGenerator.quoteTable('myTable'), { default: '[myTable]' });
    });

    it('keeps the default schema of a model that specifies it', () => {
      const MyModel = sequelizeKeep.define(
        'MyModel',
        {},
        { tableName: 'myTable', schema: defaultSchema },
      );

      expectsql(queryGenerator.quoteTable(MyModel), { default: qualifiedTable });
      expectsql(queryGenerator.quoteTable({ ...MyModel.table }), { default: qualifiedTable });
    });

    it('omits the schema of a model that does not specify one', () => {
      const MyModel = sequelizeKeep.define('MyModel', {}, { tableName: 'myTable' });

      expectsql(queryGenerator.quoteTable(MyModel), { default: '[myTable]' });
      expectsql(queryGenerator.quoteTable({ ...MyModel.table }), { default: '[myTable]' });
    });

    it('keeps the default schema when it is the schema option of Sequelize', () => {
      const sequelizeSchema = createSequelizeInstance({
        keepExplicitDefaultSchema: true,
        schema: defaultSchema,
      });

      expectsql(sequelizeSchema.queryGenerator.quoteTable('myTable'), { default: qualifiedTable });
    });

    it('keeps the default schema passed to withSchema', () => {
      const MyModel = sequelizeKeep.define('MyModel', {}, { tableName: 'myTable' });

      expectsql(queryGenerator.quoteTable(MyModel.withSchema(defaultSchema)), {
        default: qualifiedTable,
      });
    });

    it('omits the schema after resetting it with withSchema', () => {
      const MyModel = sequelizeKeep.define(
        'MyModel',
        {},
        { tableName: 'myTable', schema: defaultSchema },
      );

      expectsql(queryGenerator.quoteTable(MyModel.withSchema(null)), { default: '[myTable]' });
    });

    it('omits the schema of a scoped model that does not specify one', () => {
      const MyModel = sequelizeKeep.define('MyModel', {}, { tableName: 'myTable' });

      expectsql(queryGenerator.quoteTable(MyModel.withoutScope()), { default: '[myTable]' });
    });

    it('keeps the default schema of a scoped model that specifies it', () => {
      const MyModel = sequelizeKeep.define(
        'MyModel',
        {},
        { tableName: 'myTable', schema: defaultSchema },
      );

      expectsql(queryGenerator.quoteTable(MyModel.withoutScope()), { default: qualifiedTable });
    });

    it('keeps the default schema passed to withSchema when returning to the initial scope', () => {
      const MyModel = sequelizeKeep.define('MyModel', {}, { tableName: 'myTable' });

      expectsql(queryGenerator.quoteTable(MyModel.withSchema(defaultSchema).withInitialScope()), {
        default: qualifiedTable,
      });
    });

    it('omits the schema reset with withSchema when returning to the initial scope', () => {
      const MyModel = sequelizeKeep.define(
        'MyModel',
        {},
        { tableName: 'myTable', schema: defaultSchema },
      );

      expectsql(queryGenerator.quoteTable(MyModel.withSchema(null).withInitialScope()), {
        default: '[myTable]',
      });
    });
  });
});
