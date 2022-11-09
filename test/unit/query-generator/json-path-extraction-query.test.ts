import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

const notSupportedError = new Error(`JSON operations are not supported in ${dialectName}.`);

describe('QueryGenerator#jsonPathExtractionQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('should handle isJson parameter true', () => {
    expectsql(() => queryGenerator.jsonPathExtractionQuery('profile', 'id', true), {
      default: notSupportedError,
      mariadb: 'json_unquote(json_extract(`profile`,\'$.id\'))',
      mysql: 'json_unquote(json_extract(`profile`,\'$.\\"id\\"\'))',
      postgres: `("profile"#>'{id}')`,
      sqlite: 'json_extract(`profile`,\'$.id\')',
    });
  });

  it('should use default handling if isJson is false', () => {
    expectsql(() => queryGenerator.jsonPathExtractionQuery('profile', 'id', false), {
      default: notSupportedError,
      mariadb: 'json_unquote(json_extract(`profile`,\'$.id\'))',
      mysql: 'json_unquote(json_extract(`profile`,\'$.\\"id\\"\'))',
      postgres: `("profile"#>>'{id}')`,
      sqlite: 'json_extract(`profile`,\'$.id\')',
    });
  });

  it('should use default handling if isJson is not passed', () => {
    expectsql(() => queryGenerator.jsonPathExtractionQuery('profile', 'id'), {
      default: notSupportedError,
      mariadb: 'json_unquote(json_extract(`profile`,\'$.id\'))',
      mysql: 'json_unquote(json_extract(`profile`,\'$.\\"id\\"\'))',
      postgres: `("profile"#>>'{id}')`,
      sqlite: 'json_extract(`profile`,\'$.id\')',
    });
  });

  it('should support passing a string array as path', () => {
    expectsql(() => queryGenerator.jsonPathExtractionQuery('profile', ['id', 'username']), {
      default: notSupportedError,
      mariadb: 'json_unquote(json_extract(`profile`,\'$.id.username\'))',
      mysql: 'json_unquote(json_extract(`profile`,\'$.\\"id\\".\\"username\\"\'))',
      postgres: `("profile"#>>'{id,username}')`,
      sqlite: 'json_extract(`profile`,\'$.id.username\')',
    });
  });
});
