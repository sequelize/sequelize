import { sql as sqlTag } from '@sequelize/core';
import { expect } from 'chai';
import { expectsql, sequelize } from '../../support';

const { literal } = sqlTag;

describe('QueryGenerator#unionQuery', () => {
  const queryGenerator = sequelize.queryGenerator;
  const quote = (identifier: string) => queryGenerator.quoteIdentifier(identifier);

  // `unionQuery` receives the SQL of its members already generated, so plain strings are enough
  // here. Turning models into these queries is `Sequelize#union`'s job.
  const members = [
    `SELECT ${quote('id')}, ${quote('name')} FROM ${quote('Users')} AS ${quote('User')};`,
    `SELECT ${quote('id')}, ${quote('name')} FROM ${quote('Guests')} AS ${quote('Guest')};`,
  ];

  // The expectations are written with the dialect's own quoting rather than the generic `[]`,
  // because `expectsql` only substitutes `[]` in expectations shared by several dialects.
  const bothSelects = `${members[0].slice(0, -1)} UNION ${members[1].slice(0, -1)}`;
  const orderedByName = `${bothSelects} ORDER BY ${quote('name')}`;

  it('combines the member queries with UNION', () => {
    expectsql(queryGenerator.unionQuery(members, {}), { default: `${bothSelects};` });
  });

  it('combines the member queries with UNION ALL', () => {
    expectsql(queryGenerator.unionQuery(members, { unionAll: true }), {
      default: `${members[0].slice(0, -1)} UNION ALL ${members[1].slice(0, -1)};`,
    });
  });

  it('accepts member queries that are not terminated by a semicolon', () => {
    const unterminated = members.map(memberSql => memberSql.slice(0, -1));

    expect(queryGenerator.unionQuery(unterminated, {})).to.equal(
      queryGenerator.unionQuery(members, {}),
    );
  });

  it('supports a single member query', () => {
    expectsql(queryGenerator.unionQuery([members[0]], {}), { default: members[0] });
  });

  describe('order', () => {
    it('orders by a result column', () => {
      expectsql(queryGenerator.unionQuery(members, { order: ['name'] }), {
        default: `${orderedByName};`,
      });
    });

    it('supports an explicit direction', () => {
      expectsql(queryGenerator.unionQuery(members, { order: [['name', 'DESC']] }), {
        default: `${orderedByName} DESC;`,
      });
    });

    it('supports multiple order entries', () => {
      expectsql(queryGenerator.unionQuery(members, { order: [['name', 'DESC'], 'id'] }), {
        default: `${orderedByName} DESC, ${quote('id')};`,
      });
    });

    it('normalizes the case of the direction', () => {
      expect(queryGenerator.unionQuery(members, { order: [['name', 'desc' as 'DESC']] })).to.equal(
        queryGenerator.unionQuery(members, { order: [['name', 'DESC']] }),
      );
    });

    it('supports a literal', () => {
      expectsql(queryGenerator.unionQuery(members, { order: [literal(`${quote('name')} DESC`)] }), {
        default: `${orderedByName} DESC;`,
      });
    });

    it('escapes the ordered column instead of interpolating it', () => {
      const injected = 'id"; DROP SCHEMA public CASCADE --';

      expectsql(queryGenerator.unionQuery(members, { order: [injected] }), {
        default: `${bothSelects} ORDER BY ${quote(injected)};`,
      });
    });

    it('rejects an invalid direction instead of silently falling back to ASC', () => {
      expect(() =>
        queryGenerator.unionQuery(members, { order: [['name', 'DESCC' as 'DESC']] }),
      ).to.throw('Invalid order direction: DESCC');
    });
  });

  describe('limit/offset', () => {
    it('supports limit', () => {
      expectsql(queryGenerator.unionQuery(members, { order: ['name'], limit: 10 }), {
        default: `${orderedByName} LIMIT 10;`,
        'db2 ibmi': `${orderedByName} FETCH NEXT 10 ROWS ONLY;`,
        'mssql oracle': `${orderedByName} OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;`,
      });
    });

    it('supports limit and offset', () => {
      expectsql(queryGenerator.unionQuery(members, { order: ['name'], limit: 10, offset: 1 }), {
        default: `${orderedByName} LIMIT 10 OFFSET 1;`,
        'db2 ibmi mssql oracle': `${orderedByName} OFFSET 1 ROWS FETCH NEXT 10 ROWS ONLY;`,
      });
    });

    it('supports offset without limit', () => {
      expectsql(queryGenerator.unionQuery(members, { order: ['name'], offset: 1 }), {
        sqlite3: `${orderedByName} LIMIT -1 OFFSET 1;`,
        postgres: `${orderedByName} OFFSET 1;`,
        snowflake: `${orderedByName} LIMIT NULL OFFSET 1;`,
        'mariadb mysql': `${orderedByName} LIMIT 18446744073709551615 OFFSET 1;`,
        'db2 ibmi mssql oracle': `${orderedByName} OFFSET 1 ROWS;`,
      });
    });
  });
});
