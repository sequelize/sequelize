import { DataTypes, QueryTypes, Sequelize } from '@sequelize/core';
import { MariaDbDialect, MariaDbQuery } from '@sequelize/mariadb';
import { expect } from 'chai';

// The driver only exposes these as methods, hence the shape.
function metaColumn(options: {
  name: string;
  orgName?: string;
  orgTable?: string;
  json?: boolean;
}) {
  return {
    name: () => options.name,
    orgName: () => options.orgName ?? options.name,
    orgTable: () => options.orgTable ?? 'Users',
    isDataTypeFormatJson: () => options.json ?? false,
  };
}

describe('MariaDbQuery#handleJsonSelectQuery', () => {
  const sequelize = new Sequelize({ dialect: MariaDbDialect });

  const User = sequelize.define('User', {
    data: DataTypes.JSON,
    payload: { type: DataTypes.JSON, columnName: 'payload_json' },
    name: DataTypes.STRING,
  });

  function handle(
    rows: Array<Record<string, unknown>>,
    meta?: Array<ReturnType<typeof metaColumn>>,
  ) {
    const rowsWithMeta = Object.assign(rows, { meta });
    const query = new MariaDbQuery({}, sequelize, { model: User, plain: false, raw: false });

    query.handleJsonSelectQuery(rowsWithMeta);

    return rows;
  }

  it('parses JSON columns that the server returned as a string', () => {
    const rows = handle(
      [{ id: 1, data: '{"a":1}', name: 'Zoe' }],
      [metaColumn({ name: 'id' }), metaColumn({ name: 'data' }), metaColumn({ name: 'name' })],
    );

    expect(rows[0].data).to.deep.equal({ a: 1 });
  });

  it('leaves values the driver already parsed alone', () => {
    const rows = handle(
      [{ id: 1, data: { a: 1 } }],
      [metaColumn({ name: 'id' }), metaColumn({ name: 'data', json: true })],
    );

    expect(rows[0].data).to.deep.equal({ a: 1 });
  });

  it('does not parse a column the server reported as being in the json format', () => {
    const rows = handle(
      [{ id: 1, data: '"a string that is itself valid json"' }],
      [metaColumn({ name: 'id' }), metaColumn({ name: 'data', json: true })],
    );

    expect(rows[0].data).to.equal('"a string that is itself valid json"');
  });

  it('matches metadata by column, not by the position of the attribute in the model', () => {
    const rows = handle(
      [{ id: 1, data: '{"a":1}', payload: { b: 2 }, name: 'Zoe' }],
      [
        metaColumn({ name: 'name' }),
        metaColumn({ name: 'payload_json', json: true }),
        metaColumn({ name: 'data' }),
        metaColumn({ name: 'id' }),
      ],
    );

    expect(rows[0].data).to.deep.equal({ a: 1 });
    expect(rows[0].payload).to.deep.equal({ b: 2 });
  });

  it('matches metadata by the attribute name as well as by the column name', () => {
    const rows = handle(
      [{ id: 1, payload: '{"b":2}' }],
      [metaColumn({ name: 'id' }), metaColumn({ name: 'payload' })],
    );

    expect(rows[0].payload).to.deep.equal({ b: 2 });
  });

  it('falls back to the original column name when the column was aliased', () => {
    const rows = handle(
      [{ id: 1, data: '{"a":1}' }],
      [metaColumn({ name: 'id' }), metaColumn({ name: 'user_data', orgName: 'data' })],
    );

    expect(rows[0].data).to.deep.equal({ a: 1 });
  });

  it('does not match the original column name of a column from another table', () => {
    const rows = handle(
      [{ id: 1, data: '{"a":1}' }],
      [
        metaColumn({ name: 'id' }),
        metaColumn({ name: 'Profile.data', orgName: 'data', orgTable: 'Profiles', json: true }),
        metaColumn({ name: 'data' }),
      ],
    );

    expect(rows[0].data).to.deep.equal({ a: 1 });
  });

  it('parses the value when no metadata describes the column', () => {
    expect(handle([{ id: 1, data: '{"a":1}' }])[0].data).to.deep.equal({ a: 1 });
    expect(handle([{ id: 1, data: '{"a":1}' }], [])[0].data).to.deep.equal({ a: 1 });
  });

  it('ignores queries that are not tied to a model', () => {
    const rows = [{ data: '{"a":1}' }];
    const query = new MariaDbQuery({}, sequelize, { plain: false, raw: false });

    query.handleJsonSelectQuery(Object.assign(rows, { meta: [] }));

    expect(rows[0].data).to.equal('{"a":1}');
  });
});

describe('MariaDbQuery#formatResults', () => {
  const sequelize = new Sequelize({ dialect: MariaDbDialect });

  const User = sequelize.define(
    'User',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: DataTypes.STRING,
    },
    { timestamps: false },
  );

  // The driver returns insertId as a BigInt, which the id arithmetic relies on.
  function insert(options: Record<string, unknown>, affectedRows: number) {
    const query = new MariaDbQuery({}, sequelize, {
      type: QueryTypes.INSERT,
      model: User,
      plain: false,
      raw: false,
      ...options,
    });

    return query.formatResults({ insertId: 10n, affectedRows });
  }

  it('synthesises a contiguous id range for a plain bulkCreate', () => {
    expect(insert({}, 3)).to.deep.equal([[{ id: 10n }, { id: 11n }, { id: 12n }], 3]);
  });

  // Three submitted rows of which one collided and was updated: the server counts that row twice,
  // so a range built from affectedRows would hand out four ids for three rows.
  it('returns the raw insertId when updateOnDuplicate is set', () => {
    expect(insert({ updateOnDuplicate: ['name'] }, 4)).to.deep.equal([10n, 4]);
  });

  // Three submitted rows of which one collided and was ignored: that row is not counted at all,
  // so a range built from affectedRows would cover only two of the three.
  it('returns the raw insertId when ignoreDuplicates is set', () => {
    expect(insert({ ignoreDuplicates: true }, 2)).to.deep.equal([10n, 2]);
  });
});
