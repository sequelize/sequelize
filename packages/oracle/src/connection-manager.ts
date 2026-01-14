// Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

import type { AbstractConnection, ConnectionOptions } from '@sequelize/core';
import {
  AbstractConnectionManager,
  AccessDeniedError,
  ConnectionError,
  ConnectionRefusedError,
  ConnectionTimedOutError,
  HostNotReachableError,
  InvalidConnectionError,
} from '@sequelize/core';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import type { Connection as oracledbConnection } from 'oracledb';
import oracledb from 'oracledb';
import type { OracleDialect } from './dialect.js';

export type oracledbModule = typeof oracledb;

const debug = logger.debugContext('connection:oracle');

export interface OracleConnection extends oracledbConnection, AbstractConnection {
  on(event: 'error', listener: (err: any) => void): this;
}

export interface OracleConnectionOptions
  extends Omit<oracledb.ConnectionAttributes, 'connectionString' | 'user'> {
  database?: string;

  host?: string;

  port?: number;
}

export class OracleConnectionManager extends AbstractConnectionManager<
  OracleDialect,
  OracleConnection
> {
  readonly #lib: typeof oracledb;
  constructor(dialect: OracleDialect) {
    super(dialect);
    this.extendLib();
    this.#lib = oracledb;
  }

  buildConnectString(config: ConnectionOptions<OracleDialect>) {
    if (config.connectString) {
      if (config.host || config.database || config.port) {
        throw new Error(
          'connectString and host/database/port cannot be accepted simultaneously. Use only connectString instead.',
        );
      }

      return config.connectString;
    }

    if (!config.host || config.host.length === 0) {
      if (!config.database) {
        throw new Error('Either connectString or host/database must be provided');
      }

      return config.database;
    }

    let connectString = config.host;
    if (config.port) {
      connectString += `:${config.port}`;
    } else {
      connectString += ':1521';
    }

    if (config.database && config.database.length > 0) {
      connectString += `/${config.database}`;
    }

    return connectString;
  }

  /**
   * Method for initializing the lib
   */
  extendLib() {
    oracledb.fetchAsString = [oracledb.CLOB];

    // Retrieve BLOB always as Buffer.
    oracledb.fetchAsBuffer = [oracledb.BLOB];
  }

  async connect(config: ConnectionOptions<OracleDialect>): Promise<OracleConnection> {
    const connectionConfig: OracleConnectionOptions = {
      connectString: this.buildConnectString(config),
      ...config,
    };

    try {
      const connection: OracleConnection = (await this.#lib.getConnection(
        connectionConfig,
      )) as OracleConnection;

      debug('connection acquired');
      connection.on('error', error => {
        switch (error.code) {
          case 'ESOCKET':
          case 'ECONNRESET':
          case 'EPIPE':
          case 'PROTOCOL_CONNECTION_LOST':
            void this.sequelize.pool.destroy(connection);
            break;
          default:
        }
      });

      return connection;
    } catch (error: any) {
      let errorCode = error.message.split(':');
      errorCode = errorCode[0];

      switch (errorCode) {
        case 'ORA-12560': // ORA-12560: TNS: Protocol Adapter Error
        case 'ORA-12154': // ORA-12154: TNS: Could not resolve the connect identifier specified
        case 'ORA-12505': // ORA-12505: TNS: Listener does not currently know of SID given in connect descriptor
        case 'ORA-12514': // ORA-12514: TNS: Listener does not currently know of service requested in connect descriptor
        case 'NJS-511': // NJS-511: connection refused
        case 'NJS-516': // NJS-516: No Config Dir
        case 'NJS-517': // NJS-517: TNS Entry not found
        case 'NJS-520': // NJS-520: TNS Names File missing
          throw new ConnectionRefusedError(error);
        case 'ORA-28000': // ORA-28000: Account locked
        case 'ORA-28040': // ORA-28040: No matching authentication protocol
        case 'ORA-01017': // ORA-01017: invalid username/password; logon denied
        case 'NJS-506': // NJS-506: TLS Auth Failure
          throw new AccessDeniedError(error);
        case 'ORA-12541': // ORA-12541: TNS: No listener
        case 'NJS-503': // NJS-503: Connection Incomplete
        case 'NJS-508': // NJS-508: TLS HOST MATCH Failure
        case 'NJS-507': // NJS-507: TLS DN MATCH Failure
          throw new HostNotReachableError(error);
        case 'NJS-512': // NJS-512: Invalid Connect String Parameters
        case 'NJS-515': // NJS-515: Invalid EZCONNECT Syntax
        case 'NJS-518': // NJS-518: Invald ServiceName
        case 'NJS-519': // NJS-519: Invald SID
          throw new InvalidConnectionError(error);
        case 'ORA-12170': // ORA-12170: TNS: Connect Timeout occurred
        case 'NJS-510': // NJS-510: Connect Timeout occurred
          throw new ConnectionTimedOutError(error);
        default:
          throw new ConnectionError(error);
      }
    }
  }

  async disconnect(connection: OracleConnection) {
    if (connection.isHealthy?.() === false) {
      debug('connection tried to disconnect but was already at CLOSED state');

      return;
    }

    await new Promise<void>((resolve, reject) => {
      connection.close(error => {
        if (error) {
          debug('connection close error: %O', error);

          return void reject(error);
        }

        resolve();

        return undefined;
      });
    });
  }

  validate(connection: OracleConnection): boolean {
    return connection && connection.isHealthy();
  }
}
