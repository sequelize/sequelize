// Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

import { Sequelize } from '@sequelize/core';
import { OracleDialect } from '@sequelize/oracle';
import { expect } from 'chai';

describe('OracleConnectionManager#buildConnectString', () => {
  const sequelize = new Sequelize({ dialect: OracleDialect });
  const connectionManager = sequelize.dialect.connectionManager;

  it('returns connectString as-is when provided', () => {
    expect(
      connectionManager.buildConnectString({ connectString: 'mydb.example.com/MYSERVICE' }),
    ).to.equal('mydb.example.com/MYSERVICE');
  });

  it('throws when connectString and host are both provided', () => {
    expect(() =>
      connectionManager.buildConnectString({
        connectString: 'mydb.example.com/MYSERVICE',
        host: 'localhost',
      }),
    ).to.throw(
      'connectString and host/database/port cannot be accepted simultaneously. Use only connectString instead.',
    );
  });

  it('throws when connectString and database are both provided', () => {
    expect(() =>
      connectionManager.buildConnectString({
        connectString: 'mydb.example.com/MYSERVICE',
        database: 'MYDB',
      }),
    ).to.throw(
      'connectString and host/database/port cannot be accepted simultaneously. Use only connectString instead.',
    );
  });

  it('throws when connectString and port are both provided', () => {
    expect(() =>
      connectionManager.buildConnectString({
        connectString: 'mydb.example.com/MYSERVICE',
        port: 1521,
      }),
    ).to.throw(
      'connectString and host/database/port cannot be accepted simultaneously. Use only connectString instead.',
    );
  });

  it('returns database alone when no host is provided', () => {
    expect(connectionManager.buildConnectString({ database: 'MYDB' })).to.equal('MYDB');
  });

  it('throws when neither connectString nor host/database is provided', () => {
    expect(() => connectionManager.buildConnectString({})).to.throw(
      'Either connectString or host/database must be provided',
    );
  });

  it('builds host:port/database with all parts', () => {
    expect(
      connectionManager.buildConnectString({ host: 'localhost', port: 1522, database: 'MYDB' }),
    ).to.equal('localhost:1522/MYDB');
  });

  it('uses default port 1521 when port is not specified', () => {
    expect(
      connectionManager.buildConnectString({ host: 'localhost', database: 'MYDB' }),
    ).to.equal('localhost:1521/MYDB');
  });

  it('builds host:port without database when database is not specified', () => {
    expect(connectionManager.buildConnectString({ host: 'localhost', port: 1521 })).to.equal(
      'localhost:1521',
    );
  });
});

describe('OracleDialect#oracledbModule option', () => {
  it('uses the provided oracledbModule instead of the real oracledb library', async () => {
    const CLOB = 2006;
    const BLOB = 2007;

    let fetchAsStringSet: number[] | undefined;
    let fetchAsBufferSet: number[] | undefined;
    let getConnectionCalled = false;

    const mockOracledb = {
      CLOB,
      BLOB,
      get fetchAsString() {
        return fetchAsStringSet;
      },
      set fetchAsString(val: number[]) {
        fetchAsStringSet = val;
      },
      get fetchAsBuffer() {
        return fetchAsBufferSet;
      },
      set fetchAsBuffer(val: number[]) {
        fetchAsBufferSet = val;
      },
      async getConnection() {
        getConnectionCalled = true;
        throw new Error('NJS-511: connection refused');
      },
    };

    const sequelize = new Sequelize({
      dialect: OracleDialect,
      oracledbModule: mockOracledb as any,
      host: 'localhost',
      database: 'TESTDB',
    });

    // Trigger connect so that #getLib() is called, which sets extendLib()
    await sequelize.dialect.connectionManager
      .connect({ host: 'localhost', database: 'TESTDB' })
      .catch(() => {
        // expected — the mock throws ConnectionRefusedError
      });

    expect(fetchAsStringSet).to.deep.equal([CLOB], 'fetchAsString should be set to [CLOB]');
    expect(fetchAsBufferSet).to.deep.equal([BLOB], 'fetchAsBuffer should be set to [BLOB]');
    expect(getConnectionCalled).to.equal(true, 'getConnection should have been called on the mock');
  });

  it('calls extendLib() only once even when connect() is called multiple times', async () => {
    const mockOracledb = {
      CLOB: 2006,
      BLOB: 2007,
      fetchAsString: undefined as any,
      fetchAsBuffer: undefined as any,
      async getConnection() {
        throw new Error('NJS-511: connection refused');
      },
    };

    // Track how many times fetchAsString is assigned (extendLib sets it once)
    let fetchAsStringSetCount = 0;
    Object.defineProperty(mockOracledb, 'fetchAsString', {
      get() {
        return undefined;
      },
      set(_val: any) {
        fetchAsStringSetCount++;
      },
      configurable: true,
    });

    const sequelize = new Sequelize({
      dialect: OracleDialect,
      oracledbModule: mockOracledb as any,
      host: 'localhost',
      database: 'TESTDB',
    });

    const connectPromise = async () =>
      sequelize.dialect.connectionManager
        .connect({ host: 'localhost', database: 'TESTDB' })
        .catch(() => {
          // expected
        });

    await connectPromise();
    await connectPromise();
    await connectPromise();

    expect(fetchAsStringSetCount).to.equal(
      1,
      'extendLib() should only be called once regardless of how many times connect() is called',
    );
  });
});
