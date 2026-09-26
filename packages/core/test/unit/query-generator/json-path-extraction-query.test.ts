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
          oracle: `json_value("profile",'$."id"')`,
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
          oracle: `json_value("profile",'$[0]')`,
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
          oracle: `json_value("profile",'$."id"."username"[0][0]."name"')`,
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
          oracle: `json_value("profile",'$.""."''"."$"')`,
        },
      );
    });

    it('escapes control characters (e.g. newlines) in keys', () => {
      // mysql rejects a JSON path that contains a raw newline, and mariadb silently returns NULL for it.
      expectPerDialect(
        () =>
          queryGenerator.jsonPathExtractionQuery(
            queryGenerator.quoteIdentifier('profile'),
            ['a\nb', 'c\td'],
            false,
          ),
        {
          default: notSupportedError,
          mysql: `json_extract(\`profile\`,'$."a\\\\nb"."c\\\\td"')`,
          mariadb: `json_compact(json_extract(\`profile\`,'$."a\\\\nb"."c\\\\td"'))`,
          postgres: `"profile"#>ARRAY['a\nb','c\td']::VARCHAR(255)[]`,
          // TODO: the oracle path builder does not escape control characters
          oracle: `json_value("profile",'$."a\nb"."c\td"')`,
        },
      );
    });

    it('supports the empty key', () => {
      expectPerDialect(
        () =>
          queryGenerator.jsonPathExtractionQuery(
            queryGenerator.quoteIdentifier('profile'),
            ['x', ''],
            false,
          ),
        {
          default: notSupportedError,
          mysql: `json_extract(\`profile\`,'$.x.""')`,
          mariadb: `json_compact(json_extract(\`profile\`,'$.x.""'))`,
          postgres: `"profile"#>ARRAY['x','']::VARCHAR(255)[]`,
          // TODO: the oracle path builder produces an invalid path for the empty key
          oracle: `json_value("profile",'$."x".')`,
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

    it('escapes control characters (e.g. newlines) in keys (unquoted)', () => {
      expectPerDialect(
        () =>
          queryGenerator.jsonPathExtractionQuery(
            queryGenerator.quoteIdentifier('profile'),
            ['a\nb', 'c\td'],
            true,
          ),
        {
          default: notSupportedError,
          mssql: `JSON_VALUE([profile], N'$."a\\nb"."c\\td"')`,
          'mysql mariadb': `json_unquote(json_extract(\`profile\`,'$."a\\\\nb"."c\\\\td"'))`,
          sqlite3: `json_unquote(json_extract(\`profile\`,'$."a\\nb"."c\\td"'))`,
          postgres: `"profile"#>>ARRAY['a\nb','c\td']::VARCHAR(255)[]`,
        },
      );
    });

    it('supports the empty key (unquoted)', () => {
      expectPerDialect(
        () =>
          queryGenerator.jsonPathExtractionQuery(
            queryGenerator.quoteIdentifier('profile'),
            ['x', ''],
            true,
          ),
        {
          default: notSupportedError,
          mssql: `JSON_VALUE([profile], N'$.x.""')`,
          'mysql mariadb sqlite3': `json_unquote(json_extract(\`profile\`,'$.x.""'))`,
          postgres: `"profile"#>>ARRAY['x','']::VARCHAR(255)[]`,
        },
      );
    });
  }
});
