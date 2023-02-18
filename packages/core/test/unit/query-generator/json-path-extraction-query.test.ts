import { expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const dialectName = dialect.name;

const notSupportedError = new Error(`JSON operations are not supported in ${dialectName}.`);

describe('QueryGenerator#jsonPathExtractionQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;
  if (!dialect.supports.jsonOperations) {
    return;
  }

  // TODO: add tests that check that profile can start and end with ` or "
  // TODO: add tests where id contains characters like ., $, ', ", ,, { or }
  // TODO: throw if isJson is used but not supported by the dialect

  it('creates a json extract operation', () => {
    // "jsonPathExtractionQuery" does not quote the identifier, because the first parameter is *not* an identifier,
    // it can be any SQL expression, e.g. a column name, a function call, a subquery, etc.
    expectsql(() => queryGenerator.jsonPathExtractionQuery(queryGenerator.quoteIdentifier('profile'), ['id'], false), {
      default: notSupportedError,
      'mariadb mysql': 'json_unquote(json_extract(`profile`,\'$.id\'))',
      postgres: `"profile"->'id'`,
      sqlite: 'json_extract(`profile`,\'$.id\')',
    });
  });

  it('creates a nested json extract operation', () => {
    expectsql(() => queryGenerator.jsonPathExtractionQuery(queryGenerator.quoteIdentifier('profile'), ['id', 'username'], false), {
      default: notSupportedError,
      'mysql mariadb': 'json_unquote(json_extract(`profile`,\'$.\\"id\\".\\"username\\"\'))',
      postgres: `"profile"#>ARRAY['id','username']`,
      sqlite: 'json_extract(`profile`,\'$.id.username\')',
    });
  });
});
