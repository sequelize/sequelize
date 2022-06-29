import { injectReplacements, mapBindParameters } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { expect } from 'chai';
import {
  createSequelizeInstance,
  expectPerDialect,
  expectsql,
  sequelize,
  toHaveProperties,
  toMatchSql,
} from '../../support';

const dialect = sequelize.dialect;

const supportsNamedParameters = dialect.name === 'sqlite' || dialect.name === 'mssql';

describe('mapBindParameters', () => {
  it('parses named bind parameters', () => {
    const { sql, bindOrder } = mapBindParameters(`SELECT ${dialect.TICK_CHAR_LEFT}$id${dialect.TICK_CHAR_RIGHT} FROM users WHERE id = '$id' OR id = $id OR id = '''$id'''`, dialect);

    expectsql(sql, {
      default: `SELECT [$id] FROM users WHERE id = '$id' OR id = ? OR id = '''$id'''`,
      postgres: `SELECT "$id" FROM users WHERE id = '$id' OR id = $1 OR id = '''$id'''`,
      sqlite: `SELECT \`$id\` FROM users WHERE id = '$id' OR id = $id OR id = '''$id'''`,
      mssql: `SELECT [$id] FROM users WHERE id = '$id' OR id = @id OR id = '''$id'''`,
    });

    if (supportsNamedParameters) {
      expect(bindOrder).to.be.null;
    } else {
      expect(bindOrder).to.deep.eq(['id']);
    }
  });

  it('parses numeric bind parameters', () => {
    const { sql, bindOrder, parameterSet } = mapBindParameters(`SELECT * FROM users WHERE id = $1`, dialect);

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = ?`,
      postgres: `SELECT * FROM users WHERE id = $1`,
      sqlite: `SELECT * FROM users WHERE id = $1`,
      mssql: `SELECT * FROM users WHERE id = @1`,
    });

    if (supportsNamedParameters) {
      expect(bindOrder).to.be.null;
    } else {
      expect(bindOrder).to.deep.eq(['1']);
    }

    expect(parameterSet).to.deep.eq(new Set(['1']));
  });

  it('parses bind parameters followed by cast syntax', () => {
    const { sql } = mapBindParameters(`SELECT * FROM users WHERE id = $param::string`, dialect);

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = ?::string`,
      postgres: `SELECT * FROM users WHERE id = $1::string`,
      sqlite: `SELECT * FROM users WHERE id = $param::string`,
      mssql: `SELECT * FROM users WHERE id = @param::string`,
    });
  });

  it('parses bind parameters followed by a semicolon', () => {
    const { sql } = mapBindParameters('SELECT * FROM users WHERE id = $id;', dialect);

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = ?;`,
      postgres: `SELECT * FROM users WHERE id = $1;`,
      sqlite: `SELECT * FROM users WHERE id = $id;`,
      mssql: `SELECT * FROM users WHERE id = @id;`,
      ibmi: `SELECT * FROM users WHERE id = ?;`, // 'default' removes the ; for ibmi
    });
  });

  if (sequelize.dialect.supports.ARRAY) {
    it('does not parse bind parameters inside ARRAY[]', () => {
      const { sql } = mapBindParameters('SELECT * FROM users WHERE id = ARRAY[$id1]::int[];', dialect);

      expectsql(sql, {
        // it's a syntax error, but we still check because we accept this in replacements.
        default: 'SELECT * FROM users WHERE id = ARRAY[$id1]::int[];',
      });
    });
  }

  it('parses single letter bind parameters', () => {
    const { sql, bindOrder, parameterSet } = mapBindParameters(`SELECT * FROM users WHERE id = $a`, dialect);

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = ?`,
      postgres: `SELECT * FROM users WHERE id = $1`,
      sqlite: `SELECT * FROM users WHERE id = $a`,
      mssql: `SELECT * FROM users WHERE id = @a`,
    });

    if (supportsNamedParameters) {
      expect(bindOrder).to.be.null;
    } else {
      expect(bindOrder).to.deep.eq(['a']);
    }

    expect(parameterSet).to.deep.eq(new Set(['a']));
  });

  it(`does not consider the token to be a bind parameter if it does not follow '(', ',', '=' or whitespace`, () => {
    const { sql, bindOrder } = mapBindParameters(`SELECT * FROM users WHERE id = fn($id) OR id = fn('a',$id) OR id=$id OR id$id = 1 OR id = $id`, dialect);

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = fn(?) OR id = fn('a',?) OR id=? OR id$id = 1 OR id = ?`,
      postgres: `SELECT * FROM users WHERE id = fn($1) OR id = fn('a',$1) OR id=$1 OR id$id = 1 OR id = $1`,
      sqlite: `SELECT * FROM users WHERE id = fn($id) OR id = fn('a',$id) OR id=$id OR id$id = 1 OR id = $id`,
      mssql: `SELECT * FROM users WHERE id = fn(@id) OR id = fn('a',@id) OR id=@id OR id$id = 1 OR id = @id`,
    });

    if (supportsNamedParameters) {
      expect(bindOrder).to.be.null;
    } else if (dialect.name === 'postgres') {
      expect(bindOrder).to.deep.eq(['id']);
    } else {
      expect(bindOrder).to.deep.eq(['id', 'id', 'id', 'id']);
    }
  });

  it('does not consider the token to be a bind parameter if it is part of a $ quoted string', () => {
    const { sql, bindOrder } = mapBindParameters(`SELECT * FROM users WHERE id = $tag$ $id $tag$ OR id = $$ $id $$`, dialect);

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = $tag$ $id $tag$ OR id = $$ $id $$`,
    });

    if (supportsNamedParameters) {
      expect(bindOrder).to.be.null;
    } else {
      expect(bindOrder).to.deep.eq([]);
    }
  });

  it('does not consider the token to be a bind parameter if it is part of a nested $ quoted string', () => {
    const { sql, bindOrder } = mapBindParameters(`SELECT * FROM users WHERE id = $tag1$ $tag2$ $id $tag2$ $tag1$`, dialect);

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = $tag1$ $tag2$ $id $tag2$ $tag1$`,
    });

    if (supportsNamedParameters) {
      expect(bindOrder).to.be.null;
    } else {
      expect(bindOrder).to.deep.eq([]);
    }
  });

  it('does consider the token to be a bind parameter if it is in between two identifiers that look like $ quoted strings', () => {
    const { sql, bindOrder } = mapBindParameters(`SELECT z$$ $id x$$ * FROM users`, dialect);

    expectsql(sql, {
      default: `SELECT z$$ ? x$$ * FROM users`,
      postgres: `SELECT z$$ $1 x$$ * FROM users`,
      sqlite: `SELECT z$$ $id x$$ * FROM users`,
      mssql: `SELECT z$$ @id x$$ * FROM users`,
    });

    if (supportsNamedParameters) {
      expect(bindOrder).to.be.null;
    } else {
      expect(bindOrder).to.deep.eq(['id']);
    }
  });

  it('does not consider the token to be a bind parameter if it is part of a string with a backslash escaped quote, in dialects that support backslash escape', () => {
    expectPerDialect(() => mapBindParameters(`SELECT * FROM users WHERE id = '\\' $id' OR id = $id`, dialect), {
      default: new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = '\\' $id' OR id = $id`),

      'mysql mariadb': toHaveProperties({
        sql: toMatchSql(`SELECT * FROM users WHERE id = '\\' $id' OR id = ?`),
        bindOrder: ['id'],
      }),
    });
  });

  it('does not consider the token to be a bind parameter if it is part of a string with a backslash escaped quote, in dialects that support standardConformingStrings = false', () => {
    expectPerDialect(() => mapBindParameters(`SELECT * FROM users WHERE id = '\\' $id' OR id = $id`, getNonStandardConfirmingStringDialect()), {
      default: new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = '\\' $id' OR id = $id`),

      'mysql mariadb': toHaveProperties({
        sql: toMatchSql(`SELECT * FROM users WHERE id = '\\' $id' OR id = ?`),
        bindOrder: ['id'],
      }),
      postgres: toHaveProperties({
        sql: `SELECT * FROM users WHERE id = '\\' $id' OR id = $1`,
        bindOrder: ['id'],
      }),
    });
  });

  it('does not consider the token to be a bind parameter if it is part of an E-prefixed string with a backslash escaped quote, in dialects that support E-prefixed strings', () => {
    expectPerDialect(() => mapBindParameters(`SELECT * FROM users WHERE id = E'\\' $id' OR id = $id`, dialect), {
      default: new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = E'\\' $id' OR id = $id`),

      'mysql mariadb': toHaveProperties({
        sql: toMatchSql(`SELECT * FROM users WHERE id = E'\\' $id' OR id = ?`),
        bindOrder: ['id'],
      }),
      postgres: toHaveProperties({
        sql: `SELECT * FROM users WHERE id = E'\\' $id' OR id = $1`,
        bindOrder: ['id'],
      }),
    });
  });

  it('considers the token to be a bind parameter if it is outside a string ending with an escaped backslash', () => {
    const { sql, bindOrder } = mapBindParameters(`SELECT * FROM users WHERE id = '\\\\' OR id = $id`, dialect);

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = '\\\\' OR id = ?`,
      postgres: `SELECT * FROM users WHERE id = '\\\\' OR id = $1`,
      sqlite: `SELECT * FROM users WHERE id = '\\\\' OR id = $id`,
      mssql: `SELECT * FROM users WHERE id = '\\\\' OR id = @id`,
    });

    if (supportsNamedParameters) {
      expect(bindOrder).to.be.null;
    } else {
      expect(bindOrder).to.deep.eq(['id']);
    }
  });

  it('does not consider the token to be a bind parameter if it is part of a string with an escaped backslash followed by a backslash escaped quote', () => {
    expectPerDialect(() => mapBindParameters(`SELECT * FROM users WHERE id = '\\\\\\' $id' OR id = $id`, dialect), {
      default: new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = '\\\\\\' $id' OR id = $id`),

      'mysql mariadb': toHaveProperties({
        sql: toMatchSql(`SELECT * FROM users WHERE id = '\\\\\\' $id' OR id = ?`),
        bindOrder: ['id'],
      }),
    });
  });

  it('does not consider the token to be a bind parameter if it is in a single line comment', () => {
    const { sql } = mapBindParameters(`
      SELECT * FROM users -- WHERE id = $id
      WHERE id = $id
    `, dialect);

    expectsql(sql, {
      default: `
        SELECT * FROM users -- WHERE id = $id
        WHERE id = ?
      `,
      postgres: `
        SELECT * FROM users -- WHERE id = $id
        WHERE id = $1
      `,
      sqlite: `
        SELECT * FROM users -- WHERE id = $id
        WHERE id = $id
      `,
      mssql: `
        SELECT * FROM users -- WHERE id = $id
        WHERE id = @id
      `,
    });
  });

  it('does not consider the token to be a bind parameter if it is in string but a previous comment included a string delimiter', () => {
    const { sql } = mapBindParameters(`
      SELECT * FROM users -- '
      WHERE id = ' $id '
    `, dialect);

    expectsql(sql, {
      default: `
        SELECT * FROM users -- '
        WHERE id = ' $id '
      `,
    });
  });

  it('does not consider the token to be a bind parameter if it is in a single line comment', () => {
    const { sql } = mapBindParameters(`
      SELECT * FROM users /*
      WHERE id = $id
      */
      WHERE id = $id
    `, dialect);

    expectsql(sql, {
      default: `
        SELECT * FROM users /*
        WHERE id = $id
        */
        WHERE id = ?
      `,
      postgres: `
        SELECT * FROM users /*
        WHERE id = $id
        */
        WHERE id = $1
      `,
      sqlite: `
        SELECT * FROM users /*
        WHERE id = $id
        */
        WHERE id = $id
      `,
      mssql: `
        SELECT * FROM users /*
        WHERE id = $id
        */
        WHERE id = @id
      `,
    });
  });
});

describe('injectReplacements (named replacements)', () => {
  it('parses named replacements', () => {
    const sql = injectReplacements(`SELECT ${dialect.TICK_CHAR_LEFT}:id${dialect.TICK_CHAR_RIGHT} FROM users WHERE id = ':id' OR id = :id OR id = ''':id'''`, dialect, {
      id: 1,
    });

    expectsql(sql, {
      default: `SELECT [:id] FROM users WHERE id = ':id' OR id = 1 OR id = ''':id'''`,
    });
  });

  it('throws if a named replacement is not provided as an own property', () => {
    expect(() => {
      injectReplacements(`SELECT * FROM users WHERE id = :toString`, dialect, {
        id: 1,
      });
    }).to.throw('Named replacement ":toString" has no entry in the replacement map.');

  });

  it('parses named replacements followed by cast syntax', () => {
    const sql = injectReplacements(`SELECT * FROM users WHERE id = :id::string`, dialect, {
      id: 1,
    });

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = 1::string`,
    });
  });

  it('parses named replacements followed by a semicolon', () => {
    const sql = injectReplacements('SELECT * FROM users WHERE id = :id;', dialect, {
      id: 1,
    });

    expectsql(sql, {
      default: 'SELECT * FROM users WHERE id = 1;',
      ibmi: `SELECT * FROM users WHERE id = 1;`, // 'default' removes the ; for ibmi
    });
  });

  // this is an officially supported workaround.
  // The right way to support ARRAY in replacement is https://github.com/sequelize/sequelize/issues/14410
  if (sequelize.dialect.supports.ARRAY) {
    it('parses named replacements inside ARRAY[]', () => {
      const sql = injectReplacements('SELECT * FROM users WHERE id = ARRAY[:id1]::int[] OR id = ARRAY[:id1,:id2]::int[] OR id = ARRAY[:id1, :id2]::int[];', dialect, {
        id1: 1,
        id2: 4,
      });

      expectsql(sql, {
        default: 'SELECT * FROM users WHERE id = ARRAY[1]::int[] OR id = ARRAY[1,4]::int[] OR id = ARRAY[1, 4]::int[];',
      });
    });
  }

  it('parses single letter named replacements', () => {
    const sql = injectReplacements(`SELECT * FROM users WHERE id = :a`, dialect, {
      a: 1,
    });

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = 1`,
    });
  });

  it(`does not consider the token to be a replacement if it does not follow '(', ',', '=' or whitespace`, () => {
    const sql = injectReplacements(`SELECT * FROM users WHERE id = fn(:id) OR id = fn('a',:id) OR id=:id OR id = :id`, dialect, {
      id: 1,
    });

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = fn(1) OR id = fn('a',1) OR id=1 OR id = 1`,
    });
  });

  it('does not consider the token to be a replacement if it is part of a $ quoted string', () => {
    const sql = injectReplacements(`SELECT * FROM users WHERE id = $tag$ :id $tag$ OR id = $$ :id $$`, dialect, {
      id: 1,
    });

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = $tag$ :id $tag$ OR id = $$ :id $$`,
    });
  });

  it('does not consider the token to be a replacement if it is part of a nested $ quoted string', () => {
    const sql = injectReplacements(`SELECT * FROM users WHERE id = $tag1$ $tag2$ :id $tag2$ $tag1$`, dialect, {
      id: 1,
    });

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = $tag1$ $tag2$ :id $tag2$ $tag1$`,
    });
  });

  it('does consider the token to be a replacement if it is in between two identifiers that look like $ quoted strings', () => {
    const sql = injectReplacements(`SELECT z$$ :id x$$ * FROM users`, dialect, {
      id: 1,
    });

    expectsql(sql, {
      default: `SELECT z$$ 1 x$$ * FROM users`,
    });
  });

  it('does not consider the token to be a replacement if it is part of a string with a backslash escaped quote', () => {
    const test = () => injectReplacements(`SELECT * FROM users WHERE id = '\\' :id' OR id = :id`, dialect, { id: 1 });

    expectPerDialect(test, {
      default: new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = '\\' :id' OR id = :id`),

      'mysql mariadb': toMatchSql(`SELECT * FROM users WHERE id = '\\' :id' OR id = 1`),
    });
  });

  it('does not consider the token to be a replacement if it is part of a string with a backslash escaped quote, in dialects that support standardConformingStrings = false', () => {
    const test = () => injectReplacements(`SELECT * FROM users WHERE id = '\\' :id' OR id = :id`, getNonStandardConfirmingStringDialect(), { id: 1 });

    expectPerDialect(test, {
      default: new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = '\\' :id' OR id = :id`),

      'mysql mariadb postgres': toMatchSql(`SELECT * FROM users WHERE id = '\\' :id' OR id = 1`),
    });
  });

  it('does not consider the token to be a replacement if it is part of an E-prefixed string with a backslash escaped quote, in dialects that support E-prefixed strings', () => {
    expectPerDialect(() => injectReplacements(`SELECT * FROM users WHERE id = E'\\' :id' OR id = :id`, dialect, { id: 1 }), {
      default: new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = E'\\' :id' OR id = :id`),

      'mysql mariadb postgres': toMatchSql(`SELECT * FROM users WHERE id = E'\\' :id' OR id = 1`),
    });
  });

  it('considers the token to be a replacement if it is outside a string ending with an escaped backslash', () => {
    const sql = injectReplacements(`SELECT * FROM users WHERE id = '\\\\' OR id = :id`, dialect, {
      id: 1,
    });

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = '\\\\' OR id = 1`,
    });
  });

  it('does not consider the token to be a replacement if it is part of a string with an escaped backslash followed by a backslash escaped quote', () => {
    const test = () => injectReplacements(`SELECT * FROM users WHERE id = '\\\\\\' :id' OR id = :id`, dialect, { id: 1 });

    expectPerDialect(test, {
      default: new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = '\\\\\\' :id' OR id = :id`),

      'mysql mariadb': `SELECT * FROM users WHERE id = '\\\\\\' :id' OR id = 1`,
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
      `,
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
      `,
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
      `,
    });
  });

  it('does not interpret ::x as a replacement, as it is a cast', () => {
    expect(injectReplacements(`('foo')::string`, dialect, [0])).to.equal(`('foo')::string`);
  });
});

describe('injectReplacements (positional replacements)', () => {
  it('parses positional replacements', () => {
    const sql = injectReplacements(`SELECT ${dialect.TICK_CHAR_LEFT}?${dialect.TICK_CHAR_RIGHT} FROM users WHERE id = '?' OR id = ? OR id = '''?''' OR id2 = ?`, dialect, [1, 2]);

    expectsql(sql, {
      default: `SELECT [?] FROM users WHERE id = '?' OR id = 1 OR id = '''?''' OR id2 = 2`,
    });
  });

  it('parses positional replacements followed by cast syntax', () => {
    const sql = injectReplacements(`SELECT * FROM users WHERE id = ?::string`, dialect, [1]);

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = 1::string`,
    });
  });

  it('parses positional replacements followed by a semicolon', () => {
    const sql = injectReplacements('SELECT * FROM users WHERE id = ?;', dialect, [1]);

    expectsql(sql, {
      default: 'SELECT * FROM users WHERE id = 1;',
      ibmi: 'SELECT * FROM users WHERE id = 1;', // 'default' removes the ; for ibmi
    });
  });

  // this is an officially supported workaround.
  // The right way to support ARRAY in replacement is https://github.com/sequelize/sequelize/issues/14410
  if (sequelize.dialect.supports.ARRAY) {
    it('parses positional replacements inside ARRAY[]', () => {
      const sql = injectReplacements('SELECT * FROM users WHERE id = ARRAY[?]::int[] OR ARRAY[?,?]::int[] OR ARRAY[?, ?]::int[];', dialect, [1, 1, 4, 1, 4]);

      expectsql(sql, {
        default: 'SELECT * FROM users WHERE id = ARRAY[1]::int[] OR ARRAY[1,4]::int[] OR ARRAY[1, 4]::int[];',
      });
    });
  }

  it(`does not consider the token to be a replacement if it does not follow '(', ',', '=' or whitespace`, () => {
    const sql = injectReplacements(`SELECT * FROM users WHERE id = fn(?) OR id = fn('a',?) OR id=? OR id = ?`, dialect, [2, 1, 3, 4]);

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = fn(2) OR id = fn('a',1) OR id=3 OR id = 4`,
    });
  });

  it('does not consider the token to be a replacement if it is part of a $ quoted string', () => {
    const sql = injectReplacements(`SELECT * FROM users WHERE id = $tag$ ? $tag$ OR id = $$ ? $$`, dialect, [1]);

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = $tag$ ? $tag$ OR id = $$ ? $$`,
    });
  });

  it('does not consider the token to be a replacement if it is part of a nested $ quoted string', () => {
    const sql = injectReplacements(`SELECT * FROM users WHERE id = $tag1$ $tag2$ ? $tag2$ $tag1$`, dialect, [1]);

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = $tag1$ $tag2$ ? $tag2$ $tag1$`,
    });
  });

  it('does consider the token to be a replacement if it is in between two identifiers that look like $ quoted strings', () => {
    const sql = injectReplacements(`SELECT z$$ ? x$$ * FROM users`, dialect, [1]);

    expectsql(sql, {
      default: `SELECT z$$ 1 x$$ * FROM users`,
    });
  });

  it('does not consider the token to be a replacement if it is part of a string with a backslash escaped quote', () => {
    const test = () => injectReplacements(`SELECT * FROM users WHERE id = '\\' ?' OR id = ?`, dialect, [1]);

    expectPerDialect(test, {
      default: new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = '\\' ?' OR id = ?`),

      'mysql mariadb': toMatchSql(`SELECT * FROM users WHERE id = '\\' ?' OR id = 1`),
    });
  });

  it('does not consider the token to be a replacement if it is part of a string with a backslash escaped quote, in dialects that support standardConformingStrings = false', () => {
    const test = () => injectReplacements(`SELECT * FROM users WHERE id = '\\' ?' OR id = ?`, getNonStandardConfirmingStringDialect(), [1]);

    expectPerDialect(test, {
      default: new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = '\\' ?' OR id = ?`),

      'mysql mariadb postgres': toMatchSql(`SELECT * FROM users WHERE id = '\\' ?' OR id = 1`),
    });
  });

  it('does not consider the token to be a replacement if it is part of an E-prefixed string with a backslash escaped quote, in dialects that support E-prefixed strings', () => {
    expectPerDialect(() => injectReplacements(`SELECT * FROM users WHERE id = E'\\' ?' OR id = ?`, dialect, [1]), {
      default: new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = E'\\' ?' OR id = ?`),

      'mysql mariadb postgres': toMatchSql(`SELECT * FROM users WHERE id = E'\\' ?' OR id = 1`),
    });
  });

  it('considers the token to be a replacement if it is outside a string ending with an escaped backslash', () => {
    const sql = injectReplacements(`SELECT * FROM users WHERE id = '\\\\' OR id = ?`, dialect, [1]);

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = '\\\\' OR id = 1`,
    });
  });

  it('does not consider the token to be a replacement if it is part of a string with an escaped backslash followed by a backslash escaped quote', () => {
    const test = () => injectReplacements(`SELECT * FROM users WHERE id = '\\\\\\' ?' OR id = ?`, dialect, [1]);

    expectPerDialect(test, {
      default: new Error(`The following SQL query includes an unterminated string literal:
SELECT * FROM users WHERE id = '\\\\\\' ?' OR id = ?`),

      'mysql mariadb': `SELECT * FROM users WHERE id = '\\\\\\' ?' OR id = 1`,
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
      `,
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
      `,
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
      `,
    });
  });

  // https://github.com/sequelize/sequelize/issues/14358
  it('does not parse ?& and ?| operators as replacements (#14358)', async () => {
    const sql = injectReplacements('SELECT * FROM products WHERE tags ?& ARRAY[1] AND tags ?| ARRAY[1] AND id = ?;', dialect, [1]);

    expectsql(sql, {
      default: 'SELECT * FROM products WHERE tags ?& ARRAY[1] AND tags ?| ARRAY[1] AND id = 1;',
      // 'default' removes the trailing ; for ibmi, but we actually need to test it's there this time, to ensure '?;' is treated as a replacement + ';'
      ibmi: 'SELECT * FROM products WHERE tags ?& ARRAY[1] AND tags ?| ARRAY[1] AND id = 1;',
    });
  });

  it('formats where clause correctly when the value is falsy', () => {
    expect(injectReplacements('foo = ?', dialect, [0])).to.equal('foo = 0');
  });

  it('formats arrays as an expression instead of an ARRAY data type', async () => {
    const sql = injectReplacements('INSERT INTO users (username, email, created_at, updated_at) VALUES ?;', dialect, [[
      ['john', 'john@gmail.com', '2012-01-01 10:10:10', '2012-01-01 10:10:10'],
      ['michael', 'michael@gmail.com', '2012-01-01 10:10:10', '2012-01-01 10:10:10'],
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
          (N'michael', N'michael@gmail.com', N'2012-01-01 10:10:10', N'2012-01-01 10:10:10');`,
    });
  });
});

function getNonStandardConfirmingStringDialect() {
  return createSequelizeInstance({
    standardConformingStrings: false,
  }).dialect;
}
