import { Sequelize } from '@sequelize/core';
import { PostgresDialect } from '@sequelize/postgres';
import { expect } from 'chai';

const HSTORE_OID = 90_001;
const HSTORE_ARRAY_OID = 90_002;

/**
 * Builds a connection manager whose OID map is populated without a database.
 * `refreshDynamicOids` normally reads it out of `pg_type`.
 */
async function buildConnectionManager() {
  const sequelize = new Sequelize({ dialect: PostgresDialect });

  (sequelize as { query: unknown }).query = async () => [
    { rows: [{ typname: 'hstore', typtype: 'b', oid: HSTORE_OID, typarray: HSTORE_ARRAY_OID }] },
  ];

  await sequelize.dialect.connectionManager.refreshDynamicOids();

  return sequelize.dialect.connectionManager;
}

describe('PostgresConnectionManager#getTypeParser', () => {
  it('returns the dialect parser for a type it knows', async () => {
    const connectionManager = await buildConnectionManager();

    expect(connectionManager.getTypeParser(HSTORE_OID, 'text')('"a"=>"b"')).to.deep.equal({
      a: 'b',
    });
  });

  it('caches parsers per type', async () => {
    const connectionManager = await buildConnectionManager();

    expect(connectionManager.getTypeParser(HSTORE_OID, 'text')).to.equal(
      connectionManager.getTypeParser(HSTORE_OID, 'text'),
    );
  });

  it('treats an omitted format as the text format', async () => {
    const connectionManager = await buildConnectionManager();

    expect(connectionManager.getTypeParser(HSTORE_OID)).to.equal(
      connectionManager.getTypeParser(HSTORE_OID, 'text'),
    );
  });

  it('does not hand out a text parser for the binary format', async () => {
    const connectionManager = await buildConnectionManager();

    // The dialect's parsers take a string, so they must not be reused for the binary format,
    // which pg hands a Buffer. Caching them per OID alone made whichever format was requested
    // first win for both.
    const textParser = connectionManager.getTypeParser(HSTORE_OID, 'text');
    const binaryParser = connectionManager.getTypeParser(HSTORE_OID, 'binary');

    expect(binaryParser).to.not.equal(textParser);
    expect(binaryParser(Buffer.from('"a"=>"b"'))).to.equal('"a"=>"b"');
  });

  it('does not hand out a binary parser for the text format', async () => {
    const connectionManager = await buildConnectionManager();

    // Same as above, with the formats requested in the other order.
    const binaryParser = connectionManager.getTypeParser(HSTORE_OID, 'binary');
    const textParser = connectionManager.getTypeParser(HSTORE_OID, 'text');

    expect(textParser).to.not.equal(binaryParser);
    expect(textParser('"a"=>"b"')).to.deep.equal({ a: 'b' });
  });

  it('parses arrays with the text parser of their base type', async () => {
    const connectionManager = await buildConnectionManager();

    expect(
      connectionManager.getTypeParser(HSTORE_ARRAY_OID, 'text')('{"\\"a\\"=>\\"b\\""}'),
    ).to.deep.equal([{ a: 'b' }]);
  });
});
