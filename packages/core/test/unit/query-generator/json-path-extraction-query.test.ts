import { expectPerDialect, sequelize } from '../../support';

const dialect = sequelize.dialect;
const dialectName = dialect.name;

const notSupportedError = new Error(`JSON Paths are not supported in ${dialectName}.`);

describe('QueryGenerator#jsonPathExtractionQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  if (dialect.supports.jsonExtraction.quoted) {
    it('creates a json extract operation (object)', () => {
      // "jsonPathExtractionQuery" does not quote the first parameter, because the first parameter is *not* an identifier,
      // it can be any SQL expression, e.g. a column name, a function call, a subquery, etc.
      expectPerDialect(
        () =>
          queryGenerator.jsonPathExtractionQuery(
            queryGenerator.quoteIdentifier('profile'),
            ['id'],
            false,
          ),
        {
          default: notSupportedError,
          mariadb: `json_compact(json_extract(\`profile\`,'$.id'))`,
          'mysql sqlite3': `json_extract(\`profile\`,'$.id')`,
          postgres: `"profile"->'id'`,
        },
      );
    });

    it('creates a json extract operation (array)', () => {
      expectPerDialect(
        () =>
          queryGenerator.jsonPathExtractionQuery(
            queryGenerator.quoteIdentifier('profile'),
            [0],
            false,
          ),
        {
          default: notSupportedError,
          mariadb: `json_compact(json_extract(\`profile\`,'$[0]'))`,
          'mysql sqlite3': `json_extract(\`profile\`,'$[0]')`,
          postgres: `"profile"->0`,
        },
      );
    });

    it('creates a nested json extract operation', () => {
      expectPerDialect(
        () =>
          queryGenerator.jsonPathExtractionQuery(
            queryGenerator.quoteIdentifier('profile'),
            ['id', 'username', 0, '0', 'name'],
            false,
          ),
        {
          default: notSupportedError,
          mariadb: `json_compact(json_extract(\`profile\`,'$.id.username[0]."0".name'))`,
          'mysql sqlite3': `json_extract(\`profile\`,'$.id.username[0]."0".name')`,
          postgres: `"profile"#>ARRAY['id','username','0','0','name']::VARCHAR(255)[]`,
        },
      );
    });

    it(`escapes characters such as ", $, and '`, () => {
      expectPerDialect(
        () =>
          queryGenerator.jsonPathExtractionQuery(
            queryGenerator.quoteIdentifier('profile'),
            [`"`, `'`, `$`],
            false,
          ),
        {
          default: notSupportedError,
          mysql: `json_extract(\`profile\`,'$."\\\\""."\\'"."$"')`,
          mariadb: `json_compact(json_extract(\`profile\`,'$."\\\\""."\\'"."$"'))`,
          sqlite3: `json_extract(\`profile\`,'$."\\""."''"."$"')`,
          postgres: `"profile"#>ARRAY['"','''','$']::VARCHAR(255)[]`,
        },
      );
    });
  }

  if (dialect.supports.jsonExtraction.unquoted) {
    it('creates a json extract+unquote operation (object)', () => {
      // "jsonPathExtractionQuery" does not quote the first parameter, because the first parameter is *not* an identifier,
      // it can be any SQL expression, e.g. a column name, a function call, a subquery, etc.
      expectPerDialect(
        () =>
          queryGenerator.jsonPathExtractionQuery(
            queryGenerator.quoteIdentifier('profile'),
            ['id'],
            true,
          ),
        {
          default: notSupportedError,
          mssql: `JSON_VALUE([profile], N'$.id')`,
          'mariadb mysql sqlite3': `json_unquote(json_extract(\`profile\`,'$.id'))`,
          postgres: `"profile"->>'id'`,
        },
      );
    });

    it('creates a json extract+unquote operation (array)', () => {
      expectPerDialect(
        () =>
          queryGenerator.jsonPathExtractionQuery(
            queryGenerator.quoteIdentifier('profile'),
            [0],
            true,
          ),
        {
          default: notSupportedError,
          mssql: `JSON_VALUE([profile], N'$[0]')`,
          'mariadb mysql sqlite3': `json_unquote(json_extract(\`profile\`,'$[0]'))`,
          postgres: `"profile"->>0`,
        },
      );
    });

    it('creates a nested json extract+unquote operation', () => {
      expectPerDialect(
        () =>
          queryGenerator.jsonPathExtractionQuery(
            queryGenerator.quoteIdentifier('profile'),
            ['id', 'username', 0, '0', 'name'],
            true,
          ),
        {
          default: notSupportedError,
          mssql: `JSON_VALUE([profile], N'$.id.username[0]."0".name')`,
          'mysql mariadb sqlite3': `json_unquote(json_extract(\`profile\`,'$.id.username[0]."0".name'))`,
          postgres: `"profile"#>>ARRAY['id','username','0','0','name']::VARCHAR(255)[]`,
        },
      );
    });
  }
});
