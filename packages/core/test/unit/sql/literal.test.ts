import { Op, cast, fn, json, sql, where } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const queryGenerator = sequelize.queryGenerator;

describe('json', () => {
  if (!dialect.supports.jsonOperations || !dialect.supports.jsonExtraction.quoted) {
    return;
  }

  it('supports WhereOptions', () => {
    const conditions = {
      metadata: {
        language: 'icelandic',
        pg_rating: { dk: 'G' },
      },
      another_json_field: { x: 1 },
    };

    expectsql(() => queryGenerator.escape(json(conditions)), {
      postgres: `("metadata"->'language' = '"icelandic"' AND "metadata"#>ARRAY['pg_rating','dk']::VARCHAR(255)[] = '"G"') AND "another_json_field"->'x' = '1'`,
      sqlite3: `(json_extract(\`metadata\`,'$.language') = '"icelandic"' AND json_extract(\`metadata\`,'$.pg_rating.dk') = '"G"') AND json_extract(\`another_json_field\`,'$.x') = '1'`,
      mariadb: `(json_compact(json_extract(\`metadata\`,'$.language')) = '"icelandic"' AND json_compact(json_extract(\`metadata\`,'$.pg_rating.dk')) = '"G"') AND json_compact(json_extract(\`another_json_field\`,'$.x')) = '1'`,
      mysql: `(json_extract(\`metadata\`,'$.language') = CAST('"icelandic"' AS JSON) AND json_extract(\`metadata\`,'$.pg_rating.dk') = CAST('"G"' AS JSON)) AND json_extract(\`another_json_field\`,'$.x') = CAST('1' AS JSON)`,
    });
  });

  it('supports the json path notation', () => {
    const path = 'metadata.pg_rating.dk';

    expectsql(() => queryGenerator.escape(json(path)), {
      postgres: `"metadata"#>ARRAY['pg_rating','dk']::VARCHAR(255)[]`,
      mariadb: `json_compact(json_extract(\`metadata\`,'$.pg_rating.dk'))`,
      'sqlite3 mysql': `json_extract(\`metadata\`,'$.pg_rating.dk')`,
    });
  });

  it('supports numbers in the dot notation', () => {
    expectsql(() => queryGenerator.escape(json('profile.id.0.1')), {
      postgres: `"profile"#>ARRAY['id','0','1']::VARCHAR(255)[]`,
      mariadb: `json_compact(json_extract(\`profile\`,'$.id."0"."1"'))`,
      'sqlite3 mysql': `json_extract(\`profile\`,'$.id."0"."1"')`,
    });
  });

  it('can take a value to compare against', () => {
    const path = 'metadata.pg_rating.is';
    const value = 'U';

    expectsql(() => queryGenerator.escape(json(path, value)), {
      postgres: `"metadata"#>ARRAY['pg_rating','is']::VARCHAR(255)[] = '"U"'`,
      sqlite3: `json_extract(\`metadata\`,'$.pg_rating.is') = '"U"'`,
      mariadb: `json_compact(json_extract(\`metadata\`,'$.pg_rating.is')) = '"U"'`,
      mysql: `json_extract(\`metadata\`,'$.pg_rating.is') = CAST('"U"' AS JSON)`,
    });
  });

  // TODO: add a way to let `where` know what the type of the value is in raw queries
  // it('accepts a condition object', () => {
  //   expectsql(queryGenerator.escape(json({ id: 1 })), {
  //     postgres: `"id" = '1'`,
  //   });
  // });
  //
  // it('column named "json"', () => {
  //   expectsql(queryGenerator.escape(where(json('json'), Op.eq, {})), {
  //     postgres: `("json"#>>'{}') = '{}'`,
  //   });
  // });

  it('accepts a nested condition object', () => {
    expectsql(() => queryGenerator.escape(json({ profile: { id: 1 } })), {
      postgres: `"profile"->'id' = '1'`,
      sqlite3: `json_extract(\`profile\`,'$.id') = '1'`,
      mariadb: `json_compact(json_extract(\`profile\`,'$.id')) = '1'`,
      mysql: `json_extract(\`profile\`,'$.id') = CAST('1' AS JSON)`,
    });
  });

  it('accepts multiple condition object', () => {
    expectsql(
      () => queryGenerator.escape(json({ property: { value: 1 }, another: { value: 'string' } })),
      {
        postgres: `"property"->'value' = '1' AND "another"->'value' = '"string"'`,
        sqlite3: `json_extract(\`property\`,'$.value') = '1' AND json_extract(\`another\`,'$.value') = '"string"'`,
        mariadb: `json_compact(json_extract(\`property\`,'$.value')) = '1' AND json_compact(json_extract(\`another\`,'$.value')) = '"string"'`,
        mysql: `json_extract(\`property\`,'$.value') = CAST('1' AS JSON) AND json_extract(\`another\`,'$.value') = CAST('"string"' AS JSON)`,
      },
    );
  });

  it('can be used inside of where', () => {
    expectsql(() => queryGenerator.escape(where(json('profile.id'), '1')), {
      postgres: `"profile"->'id' = '"1"'`,
      sqlite3: `json_extract(\`profile\`,'$.id') = '"1"'`,
      mariadb: `json_compact(json_extract(\`profile\`,'$.id')) = '"1"'`,
      mysql: `json_extract(\`profile\`,'$.id') = CAST('"1"' AS JSON)`,
    });
  });
});

describe('cast', () => {
  it('accepts condition object (auto casting)', () => {
    expectsql(
      () =>
        queryGenerator.escape(
          fn(
            'SUM',
            cast(
              {
                [Op.or]: {
                  foo: 'foo',
                  bar: 'bar',
                },
              },
              'int',
            ),
          ),
        ),
      {
        default: `SUM(CAST(([foo] = 'foo' OR [bar] = 'bar') AS INT))`,
        mssql: `SUM(CAST(([foo] = N'foo' OR [bar] = N'bar') AS INT))`,
      },
    );
  });
});

describe('fn', () => {
  // this was a band-aid over a deeper problem ('$bind' being considered to be a bind parameter when it's a string), which has been fixed
  it('should not escape $ in fn() arguments', () => {
    const out = queryGenerator.escape(fn('upper', '$user'));

    expectsql(out, {
      default: `upper('$user')`,
      mssql: `upper(N'$user')`,
    });
  });

  it('accepts all sorts of values as arguments', () => {
    const out = queryGenerator.escape(
      fn(
        'concat',
        'user',
        1,
        true,
        new Date(Date.UTC(2011, 2, 27, 10, 1, 55)),
        fn('lower', 'user'),
      ),
    );

    expectsql(out, {
      postgres: `concat('user', 1, true, '2011-03-27 10:01:55.000 +00:00', lower('user'))`,
      mssql: `concat(N'user', 1, 1, N'2011-03-27 10:01:55.000 +00:00', lower(N'user'))`,
      sqlite3: `concat('user', 1, 1, '2011-03-27 10:01:55.000 +00:00', lower('user'))`,
      ibmi: `concat('user', 1, 1, '2011-03-27 10:01:55.000', lower('user'))`,
      default: `concat('user', 1, true, '2011-03-27 10:01:55.000', lower('user'))`,
    });
  });

  it('accepts arrays', () => {
    if (!dialect.supports.dataTypes.ARRAY) {
      return;
    }

    const out = queryGenerator.escape(fn('concat', ['abc']));

    expectsql(out, {
      default: `concat(ARRAY['abc'])`,
      postgres: `concat(ARRAY['abc']::VARCHAR(255)[])`,
    });
  });
});

describe('sql.join', () => {
  it('joins parts with a separator', () => {
    const columns = ['a', 'b', 'c'];

    // SQL expression parts, string separator
    expectsql(
      queryGenerator.escape(
        sql`SELECT ${sql.join(
          columns.map(col => sql.identifier(col)),
          ', ',
        )} FROM users`,
      ),
      {
        default: `SELECT [a], [b], [c] FROM users`,
      },
    );

    // string parts, SQL expression separator
    expectsql(
      queryGenerator.escape(
        sql`SELECT a FROM users WHERE id IN (${sql.join(['id1', 'id2', 'id3'], sql`, `)}) FROM users`,
      ),
      {
        default: `SELECT a FROM users WHERE id IN ('id1', 'id2', 'id3') FROM users`,
        mssql: `SELECT a FROM users WHERE id IN (N'id1', N'id2', N'id3') FROM users`,
      },
    );
  });
});

describe('sql.identifier', () => {
  it('accepts strings', () => {
    const out = queryGenerator.escape(sql.identifier('foo'));

    expectsql(out, {
      default: `[foo]`,
    });
  });

  it('accepts table structures', () => {
    const out = queryGenerator.escape(sql.identifier({ schema: 'foo', tableName: 'bar' }));

    expectsql(out, {
      default: `[foo].[bar]`,
      sqlite3: '`foo.bar`',
    });
  });

  it('accepts model classes', () => {
    const User = sequelize.define(
      'User',
      {},
      {
        schema: 'schema',
        tableName: 'users',
      },
    );

    const out = queryGenerator.escape(sql.identifier(User));

    expectsql(out, {
      default: `[schema].[users]`,
      sqlite3: '`schema.users`',
    });
  });

  it('accepts model definitions', () => {
    const User = sequelize.define(
      'User',
      {},
      {
        schema: 'schema',
        tableName: 'users',
      },
    );

    const out = queryGenerator.escape(sql.identifier(User.modelDefinition));

    expectsql(out, {
      default: `[schema].[users]`,
      sqlite3: '`schema.users`',
    });
  });

  it('accepts multiple parameters', () => {
    const User = sequelize.define(
      'User',
      {},
      {
        schema: 'schema',
        tableName: 'table',
      },
    );

    const out = queryGenerator.escape(sql.identifier('database', User, 'column'));

    expectsql(out, {
      default: `[database].[schema].[table].[column]`,
      sqlite3: '`database`.`schema.table`.`column`',
    });
  });
});
