import { expect } from 'chai';
import { cast, fn, Op, json, where } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const queryGenerator = sequelize.queryGenerator;

describe('json', () => {
  if (!dialect.supports.jsonOperations) {
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
    const expected = `("metadata"->'language' = '"icelandic"' AND "metadata"#>ARRAY['pg_rating','dk'] = '"G"') AND "another_json_field"->'x' = '1'`;
    expect(queryGenerator.escape(json(conditions))).to.deep.equal(expected);
  });

  it('supports the json path notation', () => {
    const path = 'metadata.pg_rating.dk';
    expect(queryGenerator.escape(json(path))).to.equal(`"metadata"#>ARRAY['pg_rating','dk']`);
  });

  it('supports numbers in the dot notation', () => {
    expectsql(queryGenerator.escape(json('profile.id.0.1')), {
      postgres: `"profile"#>ARRAY['id','0','1']`,
    });
  });

  it('can take a value to compare against', () => {
    const path = 'metadata.pg_rating.is';
    const value = 'U';
    expect(queryGenerator.escape(json(path, value))).to.equal(`"metadata"#>ARRAY['pg_rating','is'] = '"U"'`);
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
    expectsql(queryGenerator.escape(json({ profile: { id: 1 } })), {
      postgres: `"profile"->'id' = '1'`,
    });
  });

  it('accepts multiple condition object', () => {
    expectsql(queryGenerator.escape(json({ property: { value: 1 }, another: { value: 'string' } })), {
      postgres: `"property"->'value' = '1' AND "another"->'value' = '"string"'`,
    });
  });

  it('can be used inside of where', () => {
    expectsql(queryGenerator.escape(where(json('profile.id'), '1')), {
      postgres: `"profile"->'id' = '"1"'`,
    });
  });
});

describe('cast', () => {
  it('accepts condition object (auto casting)', () => {
    expectsql(() => queryGenerator.escape(fn('SUM', cast({
      [Op.or]: {
        foo: 'foo',
        bar: 'bar',
      },
    }, 'int'))), {
      default: `SUM(CAST(([foo] = 'foo' OR [bar] = 'bar') AS INT))`,
      mssql: `SUM(CAST(([foo] = N'foo' OR [bar] = N'bar') AS INT))`,
    });
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
});
