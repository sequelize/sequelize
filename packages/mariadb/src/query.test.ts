import { DataTypes, Sequelize } from '@sequelize/core';
import { MariaDbDialect, MariaDbQuery } from '@sequelize/mariadb';
import { expect } from 'chai';

/**
 * The subset of the mariadb driver's `ColumnDefinition` that {@link MariaDbQuery#handleJsonSelectQuery}
 * relies on. The driver only exposes these as methods, hence the shape.
 *
 * @param options
 * @param options.name The alias the column has in the result set.
 * @param options.orgName The name the column has in its table. Defaults to `name`.
 * @param options.orgTable The table the column originates from. Defaults to `Users`.
 * @param options.json Whether the server reported the column's extended type as `json`.
 */
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

  /**
   * Runs `handleJsonSelectQuery` over `rows`, which it mutates in place, and returns them.
   *
   * @param rows
   * @param meta The result-set metadata, as the driver exposes it on the rows array.
   */
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
    // MariaDB 10.5.2+ returns JSON columns already decoded. Parsing them again would either
    // throw or, for values that happen to be valid JSON twice over, silently corrupt them.
    const rows = handle(
      [{ id: 1, data: '"a string that is itself valid json"' }],
      [metaColumn({ name: 'id' }), metaColumn({ name: 'data', json: true })],
    );

    expect(rows[0].data).to.equal('"a string that is itself valid json"');
  });

  it('matches metadata by column, not by the position of the attribute in the model', () => {
    // The metadata follows the order of the SELECT clause, which has no relation to the order
    // of the model's attributes. Indexing into it by attribute position made `data` pick up
    // `payload_json`'s metadata and skip parsing because that column is in the json format.
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
    // Under an `include`, a joined table can expose a column with the same original name as one
    // of this model's attributes. Picking that one up would apply the wrong json format to it.
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
