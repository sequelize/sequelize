const { injectReplacements } = require('sequelize/lib/utils/sql');
const { expect } = require('chai');
const {
  expectsql,
  sequelize,
  createSequelizeInstance,
  expectPerDialect,
  toMatchSql
} = require('../../support');

const dialect = sequelize.dialect;

describe('injectReplacements (named replacements)', () => {
  it('parses named replacements', () => {
    const sql = injectReplacements(`SELECT ${dialect.TICK_CHAR_LEFT}:id${dialect.TICK_CHAR_RIGHT} FROM users WHERE id = ':id' OR id = :id OR id = ''':id'''`, dialect, {
      id: 1
    });

    expectsql(sql, {
      default: 'SELECT [:id] FROM users WHERE id = \':id\' OR id = 1 OR id = \'\'\':id\'\'\''
    });
  });

  it('throws if a named replacement is not provided as an own property', () => {
    expect(() => {
      injectReplacements('SELECT * FROM users WHERE id = :toString', dialect, {
        id: 1
      });
    }).to.throw('Named replacement ":toString" has no entry in the replacement map.');
  });

  it('parses named replacements followed by cast syntax', () => {
    const sql = injectReplacements('SELECT * FROM users WHERE id = :id::string', dialect, {
      id: 1
    });

    expectsql(sql, {
      default: 'SELECT * FROM users WHERE id = 1::string'
    });
  });

  it('parses named replacements following JSONB indexing', () => {
    const sql = injectReplacements(
      'SELECT * FROM users WHERE json_col->>:key',
      dialect,
      { key: 'name' }
    );

    expectsql(sql, {
      default: "SELECT * FROM users WHERE json_col->>'name'",
      mssql: "SELECT * FROM users WHERE json_col->>N'name'"
    });
  });

  it('parses named replacements followed by a semicolon', () => {
    const sql = injectReplacements('SELECT * FROM users WHERE id = :id;', dialect, {
      id: 1
    });

    expectsql(sql, {
      default: 'SELECT * FROM users WHERE id = 1;'
    });
  });

  it('parses bind parameters following JSONB indexing', () => {
    const sql = injectReplacements(
      'SELECT * FROM users WHERE json_col->>$key',
      dialect,
      { id: 1 }
    );

    expectsql(sql, {
      default: 'SELECT * FROM users WHERE json_col->>$key'
    });
  });

  // this is a workaround.
  // The right way to support ARRAY in replacement is https://github.com/sequelize/sequelize/issues/14410
  if (sequelize.dialect.supports.ARRAY) {
    it('parses named replacements inside ARRAY[]', () => {
      const sql = injectReplacements('SELECT * FROM users WHERE id = ARRAY[:id1]::int[] OR id = ARRAY[:id1,:id2]::int[] OR id = ARRAY[:id1, :id2]::int[];', dialect, {
        id1: 1,
        id2: 4
      });

      expectsql(sql, {
        default: 'SELECT * FROM users WHERE id = ARRAY[1]::int[] OR id = ARRAY[1,4]::int[] OR id = ARRAY[1, 4]::int[];'
      });
    });
  }

  it('parses single letter named replacements', () => {
    const sql = injectReplacements('SELECT * FROM users WHERE id = :a', dialect, {
      a: 1
    });

    expectsql(sql, {
      default: 'SELECT * FROM users WHERE id = 1'
    });
  });

  it('does not consider the token to be a replacement if it does not follow \'(\', \',\', \'=\' or whitespace', () => {
    const sql = injectReplacements('SELECT * FROM users WHERE id = fn(:id) OR id = fn(\'a\',:id) OR id=:id OR id = :id', dialect, {
      id: 1
    });

    expectsql(sql, {
      default: 'SELECT * FROM users WHERE id = fn(1) OR id = fn(\'a\',1) OR id=1 OR id = 1'
    });
  });

  it('does not consider the token to be a replacement if it is part of a $ quoted string', () => {
    const sql = injectReplacements('SELECT * FROM users WHERE id = $tag$ :id $tag$ OR id = $$ :id $$', dialect, {
      id: 1
    });

    expectsql(sql, {
      default: 'SELECT * FROM users WHERE id = $tag$ :id $tag$ OR id = $$ :id $$'
    });
  });

  it('does not consider the token to be a replacement if it is part of a nested $ quoted string', () => {
    const sql = injectReplacements('SELECT * FROM users WHERE id = $tag1$ $tag2$ :id $tag2$ $tag1$', dialect, {
      id: 1
    });

    expectsql(sql, {
      default: 'SELECT * FROM users WHERE id = $tag1$ $tag2$ :id $tag2$ $tag1$'
    });
  });

  it('does consider the token to be a replacement if it is in between two identifiers that look like $ quoted strings', () => {
    const sql = injectReplacements('SELECT z$$ :id x$$ * FROM users', dialect, {
      id: 1
    });

    expectsql(sql, {
      default: 'SELECT z$$ 1 x$$ * FROM users'
    });
  });

  it('does consider the token to be a bind parameter if it is located after a $ quoted string', () => {
    const sql = injectReplacements('SELECT $$ abc $$ AS string FROM users WHERE id = :id', dialect, {
      id: 1
    });

    expectsql(sql, {
      default: 'SELECT $$ abc $$ AS string FROM users WHERE id = 1'
    });
  });

  it('does not consider the token to be a bind parameter if it is part of a string with a backslash escaped quote, in dialects that support backslash escape', () => {
    expectPerDialect(
      () =>
        injectReplacements(
          "SELECT * FROM users WHERE id = '\\' $id' OR id = $id",
          dialect,
          { id: 1 }
        ),
      {
        default:
          new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = '\\' $id' OR id = $id`),
        'mysql mariadb': toMatchSql(
          "SELECT * FROM users WHERE id = '\\' $id' OR id = $id"
        )
      }
    );
  });

  it('does not consider the token to be a bind parameter if it is part of a string with a backslash escaped quote, in dialects that support standardConformingStrings = false', () => {
    expectPerDialect(
      () =>
        injectReplacements(
          "SELECT * FROM users WHERE id = '\\' $id' OR id = $id",
          getNonStandardConfirmingStringDialect(),
          { id: 1 }
        ),
      {
        default:
          new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = '\\' $id' OR id = $id`),

        'mysql mariadb postgres': toMatchSql(
          "SELECT * FROM users WHERE id = '\\' $id' OR id = $id"
        )
      }
    );
  });

  it('does not consider the token to be a bind parameter if it is part of an E-prefixed string with a backslash escaped quote, in dialects that support E-prefixed strings', () => {
    expectPerDialect(
      () =>
        injectReplacements(
          "SELECT * FROM users WHERE id = E'\\' $id' OR id = $id",
          dialect,
          { id: 1 }
        ),
      {
        default:
          new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = E'\\' $id' OR id = $id`),
        'mysql mariadb postgres': toMatchSql(
          "SELECT * FROM users WHERE id = E'\\' $id' OR id = $id"
        )
      }
    );
  });

  it('treats strings prefixed with a lowercase e as E-prefixed strings too', () => {
    expectPerDialect(
      () =>
        injectReplacements(
          "SELECT * FROM users WHERE id = e'\\' $id' OR id = $id",
          dialect,
          { id: 1 }
        ),
      {
        default:
          new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = e'\\' $id' OR id = $id`),

        'mysql mariadb postgres': toMatchSql(
          "SELECT * FROM users WHERE id = e'\\' $id' OR id = $id"
        )
      }
    );
  });

  it('considers the token to be a replacement if it is outside a string ending with an escaped backslash', () => {
    const sql = injectReplacements('SELECT * FROM users WHERE id = \'\\\\\' OR id = :id', dialect, {
      id: 1
    });

    expectsql(sql, {
      default: 'SELECT * FROM users WHERE id = \'\\\\\' OR id = 1'
    });
  });

  it('does not consider the token to be a replacement if it is part of a string with an escaped backslash followed by a backslash escaped quote', () => {
    const test = () =>
      injectReplacements(
        "SELECT * FROM users WHERE id = '\\\\\\' :id' OR id = :id",
        dialect,
        { id: 1 }
      );

    expectPerDialect(test, {
      default:
        new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = '\\\\\\' :id' OR id = :id`),

      'mysql mariadb': "SELECT * FROM users WHERE id = '\\\\\\' :id' OR id = 1"
    });
  });

  it('does not consider the token to be a replacement if it is in a single line comment', () => {
    const sql = injectReplacements(`
      SELECT * FROM users -- WHERE id = :id
      WHERE id = :id
    `, dialect, { id: 1 });

    expectsql(sql, {
      default: `
        SELECT * FROM users -- WHERE id = :id
        WHERE id = 1
      `
    });
  });

  it('does not consider the token to be a replacement if it is in string but a previous comment included a string delimiter', () => {
    const sql = injectReplacements(`
      SELECT * FROM users -- '
      WHERE id = ' :id '
    `, dialect, { id: 1 });

    expectsql(sql, {
      default: `
        SELECT * FROM users -- '
        WHERE id = ' :id '
      `
    });
  });

  it('does not consider the token to be a replacement if it is in a single line comment', () => {
    const sql = injectReplacements(`
      SELECT * FROM users /*
      WHERE id = :id
      */
      WHERE id = :id
    `, dialect, { id: 1 });

    expectsql(sql, {
      default: `
        SELECT * FROM users /*
        WHERE id = :id
        */
        WHERE id = 1
      `
    });
  });

  it('does not interpret ::x as a replacement, as it is a cast', () => {
    expect(injectReplacements('(\'foo\')::string', dialect, [0])).to.equal('(\'foo\')::string');
  });
});

describe('injectReplacements (positional replacements)', () => {
  it('parses positional replacements', () => {
    const sql = injectReplacements(`SELECT ${dialect.TICK_CHAR_LEFT}?${dialect.TICK_CHAR_RIGHT} FROM users WHERE id = '?' OR id = ? OR id = '''?''' OR id2 = ?`, dialect, [1, 2]);

    expectsql(sql, {
      default: 'SELECT [?] FROM users WHERE id = \'?\' OR id = 1 OR id = \'\'\'?\'\'\' OR id2 = 2'
    });
  });

  it('parses positional replacements followed by cast syntax', () => {
    const sql = injectReplacements('SELECT * FROM users WHERE id = ?::string', dialect, [1]);

    expectsql(sql, {
      default: 'SELECT * FROM users WHERE id = 1::string'
    });
  });

  it('parses named replacements following JSONB indexing', () => {
    const sql = injectReplacements(
      'SELECT * FROM users WHERE json_col->>?',
      dialect,
      ['name']
    );

    expectsql(sql, {
      default: "SELECT * FROM users WHERE json_col->>'name'",
      mssql: "SELECT * FROM users WHERE json_col->>N'name'"
    });
  });

  it('parses positional replacements followed by a semicolon', () => {
    const sql = injectReplacements('SELECT * FROM users WHERE id = ?;', dialect, [1]);

    expectsql(sql, {
      default: 'SELECT * FROM users WHERE id = 1;'
    });
  });

  // this is a workaround.
  // The right way to support ARRAY in replacement is https://github.com/sequelize/sequelize/issues/14410
  if (sequelize.dialect.supports.ARRAY) {
    it('parses positional replacements inside ARRAY[]', () => {
      const sql = injectReplacements('SELECT * FROM users WHERE id = ARRAY[?]::int[] OR ARRAY[?,?]::int[] OR ARRAY[?, ?]::int[];', dialect, [1, 1, 4, 1, 4]);

      expectsql(sql, {
        default: 'SELECT * FROM users WHERE id = ARRAY[1]::int[] OR ARRAY[1,4]::int[] OR ARRAY[1, 4]::int[];'
      });
    });
  }

  it('does not consider the token to be a replacement if it does not follow \'(\', \',\', \'=\' or whitespace', () => {
    const sql = injectReplacements('SELECT * FROM users WHERE id = fn(?) OR id = fn(\'a\',?) OR id=? OR id = ?', dialect, [2, 1, 3, 4]);

    expectsql(sql, {
      default: 'SELECT * FROM users WHERE id = fn(2) OR id = fn(\'a\',1) OR id=3 OR id = 4'
    });
  });

  it('does not consider the token to be a replacement if it is part of a $ quoted string', () => {
    const sql = injectReplacements('SELECT * FROM users WHERE id = $tag$ ? $tag$ OR id = $$ ? $$', dialect, [1]);

    expectsql(sql, {
      default: 'SELECT * FROM users WHERE id = $tag$ ? $tag$ OR id = $$ ? $$'
    });
  });

  it('does not consider the token to be a replacement if it is part of a nested $ quoted string', () => {
    const sql = injectReplacements('SELECT * FROM users WHERE id = $tag1$ $tag2$ ? $tag2$ $tag1$', dialect, [1]);

    expectsql(sql, {
      default: 'SELECT * FROM users WHERE id = $tag1$ $tag2$ ? $tag2$ $tag1$'
    });
  });

  it('does consider the token to be a replacement if it is in between two identifiers that look like $ quoted strings', () => {
    const sql = injectReplacements('SELECT z$$ ? x$$ * FROM users', dialect, [1]);

    expectsql(sql, {
      default: 'SELECT z$$ 1 x$$ * FROM users'
    });
  });

  it('does not consider the token to be a replacement if it is in an unnamed $ quoted string', () => {
    const sql = injectReplacements('SELECT $$ ? $$', dialect, [1]);

    expectsql(sql, {
      default: 'SELECT $$ ? $$'
    });
  });

  it('does consider the token to be a replacement if it is located after a $ quoted string', () => {
    const sql = injectReplacements('SELECT $$ abc $$ AS string FROM users WHERE id = ?', dialect, [1]);

    expectsql(sql, {
      default: 'SELECT $$ abc $$ AS string FROM users WHERE id = 1'
    });
  });

  it('does not consider the token to be a replacement if it is part of a string with a backslash escaped quote', () => {
    const test = () =>
      injectReplacements(
        "SELECT * FROM users WHERE id = '\\' :id' OR id = :id",
        dialect,
        { id: 1 }
      );

    expectPerDialect(test, {
      default:
        new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = '\\' :id' OR id = :id`),

      'mysql mariadb': toMatchSql(
        "SELECT * FROM users WHERE id = '\\' :id' OR id = 1"
      )
    });
  });

  it('does not consider the token to be a replacement if it is part of a string with a backslash escaped quote, in dialects that support standardConformingStrings = false', () => {
    const test = () =>
      injectReplacements(
        "SELECT * FROM users WHERE id = '\\' :id' OR id = :id",
        getNonStandardConfirmingStringDialect(),
        { id: 1 }
      );

    expectPerDialect(test, {
      default:
        new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = '\\' :id' OR id = :id`),

      'mysql mariadb postgres': toMatchSql(
        "SELECT * FROM users WHERE id = '\\' :id' OR id = 1"
      )
    });
  });

  it('does not consider the token to be a replacement if it is part of an E-prefixed string with a backslash escaped quote, in dialects that support E-prefixed strings', () => {
    expectPerDialect(
      () =>
        injectReplacements(
          "SELECT * FROM users WHERE id = E'\\' :id' OR id = :id",
          dialect,
          { id: 1 }
        ),
      {
        default:
          new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = E'\\' :id' OR id = :id`),

        'mysql mariadb postgres': toMatchSql(
          "SELECT * FROM users WHERE id = E'\\' :id' OR id = 1"
        )
      }
    );
  });

  it('considers the token to be a replacement if it is outside a string ending with an escaped backslash', () => {
    const sql = injectReplacements('SELECT * FROM users WHERE id = \'\\\\\' OR id = ?', dialect, [1]);

    expectsql(sql, {
      default: 'SELECT * FROM users WHERE id = \'\\\\\' OR id = 1'
    });
  });

  it('does not consider the token to be a replacement if it is part of a string with an escaped backslash followed by a backslash escaped quote', () => {
    const test = () =>
      injectReplacements(
        "SELECT * FROM users WHERE id = '\\\\\\' :id' OR id = :id",
        dialect,
        { id: 1 }
      );

    expectPerDialect(test, {
      default:
        new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = '\\\\\\' :id' OR id = :id`),

      'mysql mariadb': "SELECT * FROM users WHERE id = '\\\\\\' :id' OR id = 1"
    });
  });

  it('does not consider the token to be a replacement if it is in a single line comment', () => {
    const sql = injectReplacements(`
      SELECT * FROM users -- WHERE id = ?
      WHERE id = ?
    `, dialect, [1]);

    expectsql(sql, {
      default: `
        SELECT * FROM users -- WHERE id = ?
        WHERE id = 1
      `
    });
  });

  it('does not consider the token to be a replacement if it is in string but a previous comment included a string delimiter', () => {
    const sql = injectReplacements(`
      SELECT * FROM users -- '
      WHERE id = ' ? '
    `, dialect, [1]);

    expectsql(sql, {
      default: `
        SELECT * FROM users -- '
        WHERE id = ' ? '
      `
    });
  });

  it('does not consider the token to be a replacement if it is in a single line comment', () => {
    const sql = injectReplacements(`
      SELECT * FROM users /*
      WHERE id = ?
      */
      WHERE id = ?
    `, dialect, [1]);

    expectsql(sql, {
      default: `
        SELECT * FROM users /*
        WHERE id = ?
        */
        WHERE id = 1
      `
    });
  });

  // https://github.com/sequelize/sequelize/issues/14358
  it('does not parse ?& and ?| operators as replacements (#14358)', async () => {
    const sql = injectReplacements('SELECT * FROM products WHERE tags ?& ARRAY[1] AND tags ?| ARRAY[1] AND id = ?;', dialect, [1]);

    expectsql(sql, {
      default: 'SELECT * FROM products WHERE tags ?& ARRAY[1] AND tags ?| ARRAY[1] AND id = 1;',
      // 'default' removes the trailing ; for ibmi, but we actually need to test it's there this time, to ensure '?;' is treated as a replacement + ';'
      ibmi: 'SELECT * FROM products WHERE tags ?& ARRAY[1] AND tags ?| ARRAY[1] AND id = 1;'
    });
  });

  it('formats where clause correctly when the value is falsy', () => {
    expect(injectReplacements('foo = ?', dialect, [0])).to.equal('foo = 0');
  });

  it('formats arrays as an expression instead of an ARRAY data type', async () => {
    const sql = injectReplacements('INSERT INTO users (username, email, created_at, updated_at) VALUES ?;', dialect, [[
      ['john', 'john@gmail.com', '2012-01-01 10:10:10', '2012-01-01 10:10:10'],
      ['michael', 'michael@gmail.com', '2012-01-01 10:10:10', '2012-01-01 10:10:10']
    ]]);

    expectsql(sql, {
      default: `
        INSERT INTO users (username, email, created_at, updated_at)
        VALUES
          ('john', 'john@gmail.com', '2012-01-01 10:10:10', '2012-01-01 10:10:10'),
          ('michael', 'michael@gmail.com', '2012-01-01 10:10:10', '2012-01-01 10:10:10');`,
      // 'default' removes the trailing ; for ibmi, but we actually need to test it's there this time, to ensure '?;' is treated as a replacement + ';'
      ibmi: `
        INSERT INTO users (username, email, created_at, updated_at)
        VALUES
          ('john', 'john@gmail.com', '2012-01-01 10:10:10', '2012-01-01 10:10:10'),
          ('michael', 'michael@gmail.com', '2012-01-01 10:10:10', '2012-01-01 10:10:10');`,
      mssql: `
        INSERT INTO users (username, email, created_at, updated_at)
        VALUES
          (N'john', N'john@gmail.com', N'2012-01-01 10:10:10', N'2012-01-01 10:10:10'),
          (N'michael', N'michael@gmail.com', N'2012-01-01 10:10:10', N'2012-01-01 10:10:10');`
    });
  });

  it('does not consider the token to be a replacement if it is part of a string with a backslash escaped quote', () => {
    const test = () =>
      injectReplacements(
        "SELECT * FROM users WHERE id = '\\' ?' OR id = ?",
        dialect,
        [1]
      );
    expectPerDialect(test, {
      default:
        new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = '\\' ?' OR id = ?`),

      'mysql mariadb': toMatchSql(
        "SELECT * FROM users WHERE id = '\\' ?' OR id = 1"
      )
    });
  });

  it('does not consider the token to be a replacement if it is part of a string with a backslash escaped quote, in dialects that support standardConformingStrings = false', () => {
    const test = () =>
      injectReplacements(
        "SELECT * FROM users WHERE id = '\\' ?' OR id = ?",
        getNonStandardConfirmingStringDialect(),
        [1]
      );

    expectPerDialect(test, {
      default:
        new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = '\\' ?' OR id = ?`),

      'mysql mariadb postgres': toMatchSql(
        "SELECT * FROM users WHERE id = '\\' ?' OR id = 1"
      )
    });
  });

  it('does not consider the token to be a replacement if it is part of an E-prefixed string with a backslash escaped quote, in dialects that support E-prefixed strings', () => {
    expectPerDialect(
      () =>
        injectReplacements(
          "SELECT * FROM users WHERE id = E'\\' ?' OR id = ?",
          dialect,
          [1]
        ),
      {
        default:
          new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = E'\\' ?' OR id = ?`),

        'mysql mariadb postgres': toMatchSql(
          "SELECT * FROM users WHERE id = E'\\' ?' OR id = 1"
        )
      }
    );
  });

  it('does not consider the token to be a replacement if it is part of a string with an escaped backslash followed by a backslash escaped quote', () => {
    const test = () =>
      injectReplacements(
        "SELECT * FROM users WHERE id = '\\\\\\' ?' OR id = ?",
        dialect,
        [1]
      );

    expectPerDialect(test, {
      default:
        new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = '\\\\\\' ?' OR id = ?`),

      'mysql mariadb': "SELECT * FROM users WHERE id = '\\\\\\' ?' OR id = 1"
    });
  });
});

function getNonStandardConfirmingStringDialect() {
  return createSequelizeInstance({
    standardConformingStrings: false
  }).dialect;
}
