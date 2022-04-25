import { mapBindParameters } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { expect } from 'chai';
import { expectsql, sequelize } from '../../support';

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

  if (dialect.name === 'postgres') {
    it('parses bind parameters followed by cast syntax', () => {
      const { sql } = mapBindParameters(`SELECT * FROM users WHERE id = $param::string`, dialect);

      // this is postgres-only syntax. It doesn't work in other dialects.
      expectsql(sql, {
        postgres: `SELECT * FROM users WHERE id = $1::string`,
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
    const { sql, bindOrder } = mapBindParameters(`SELECT * FROM users WHERE id = fn($id) OR id = fn('a',$id) OR id=$id OR id$id = 1`, dialect);

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = fn(?) OR id = fn('a',?) OR id=? OR id$id = 1`,
      postgres: `SELECT * FROM users WHERE id = fn($1) OR id = fn('a',$1) OR id=$1 OR id$id = 1`,
      sqlite: `SELECT * FROM users WHERE id = fn($id) OR id = fn('a',$id) OR id=$id OR id$id = 1`,
      mssql: `SELECT * FROM users WHERE id = fn(@id) OR id = fn('a',@id) OR id=@id OR id$id = 1`,
    });

    if (supportsNamedParameters) {
      expect(bindOrder).to.be.null;
    } else if (dialect.name === 'postgres') {
      expect(bindOrder).to.deep.eq(['id']);
    } else {
      expect(bindOrder).to.deep.eq(['id', 'id', 'id']);
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

  it('does not consider the token to be a bind parameter if it is part of a string with a backslash escaped quote', () => {
    const { sql, bindOrder } = mapBindParameters(`SELECT * FROM users WHERE id = '\\'$id' OR id = $id`, dialect);

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = '\\'$id' OR id = ?`,
      postgres: `SELECT * FROM users WHERE id = '\\'$id' OR id = $1`,
      sqlite: `SELECT * FROM users WHERE id = '\\'$id' OR id = $id`,
      mssql: `SELECT * FROM users WHERE id = '\\'$id' OR id = @id`,
    });

    if (supportsNamedParameters) {
      expect(bindOrder).to.be.null;
    } else {
      expect(bindOrder).to.deep.eq(['id']);
    }
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
    const { sql, bindOrder } = mapBindParameters(`SELECT * FROM users WHERE id = '\\\\\\'$id' OR id = $id`, dialect);

    expectsql(sql, {
      default: `SELECT * FROM users WHERE id = '\\\\\\'$id' OR id = ?`,
      postgres: `SELECT * FROM users WHERE id = '\\\\\\'$id' OR id = $1`,
      sqlite: `SELECT * FROM users WHERE id = '\\\\\\'$id' OR id = $id`,
      mssql: `SELECT * FROM users WHERE id = '\\\\\\'$id' OR id = @id`,
    });

    if (supportsNamedParameters) {
      expect(bindOrder).to.be.null;
    } else {
      expect(bindOrder).to.deep.eq(['id']);
    }
  });
});
