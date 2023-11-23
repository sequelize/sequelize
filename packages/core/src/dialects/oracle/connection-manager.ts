import type { Connection as oracledbConnection } from 'oracledb';
import {
  AccessDeniedError,
  ConnectionError,
  ConnectionRefusedError,
  ConnectionTimedOutError,
  HostNotReachableError,
  InvalidConnectionError,
} from '../../errors/index.js';
import semver from 'semver';
import type { ConnectionOptions, Sequelize } from '../../sequelize.js';
import { isError, isNodeError } from '../../utils/check.js';
import { logger } from '../../utils/logger';
import { AbstractConnectionManager } from '../abstract/connection-manager';
import { OracleDialect } from './index.js';
import type { Connection  } from '../abstract/connection-manager';

const debug = logger.debugContext('connection:oracle');

const event = require('events');

export type Lib = typeof import('oracledb');

export interface OracleConnection extends Connection, oracledbConnection {
  isHealthy(): boolean;
  on(event: 'error', listener: (err: any) => void):this;
}

export class OracleConnectionManager extends AbstractConnectionManager<OracleConnection> {
  lib: Lib;
  constructor(dialect: OracleDialect, sequelize: Sequelize) {
    super(dialect, sequelize);
    this.lib = this._loadDialectModule('oracledb') as Lib;
  }

  buildConnectString(config: ConnectionOptions) {
    if (!config.host || config.host.length === 0)
      return config.database;
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

  async connect(config: ConnectionOptions): Promise<OracleConnection> {
    const connectionConfig = {
      user: config.username,
      password: config.password,
      connectString: this.buildConnectString(config),
      ...config.dialectOptions
    };

    try {
      const connection: OracleConnection = await this.lib.getConnection(connectionConfig) as OracleConnection; 
      // @ts-ignore: Object is possibly 'null'.
      this.sequelize.options.databaseVersion = semver.coerce(connection.oracleServerVersionString).version;

      debug('connection acquired');
      connection.on('error', error => {
        switch (error.code) {
          case 'ESOCKET':
          case 'ECONNRESET':
          case 'EPIPE':
          case 'PROTOCOL_CONNECTION_LOST':
            this.pool.destroy(connection);
        }
      });

      return connection;
    } catch (err: any) {
      let errorCode = err.message.split(':');
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
          throw new ConnectionRefusedError(err);
        case 'ORA-28000': // ORA-28000: Account locked
        case 'ORA-28040': // ORA-28040: No matching authentication protocol
        case 'ORA-01017': // ORA-01017: invalid username/password; logon denied
        case 'NJS-506': // NJS-506: TLS Auth Failure
          throw new AccessDeniedError(err);
        case 'ORA-12541': // ORA-12541: TNS: No listener
        case 'NJS-503': // NJS-503: Connection Incomplete
        case 'NJS-508': // NJS-508: TLS HOST MATCH Failure
        case 'NJS-507': // NJS-507: TLS DN MATCH Failure
          throw new HostNotReachableError(err);
        case 'NJS-512': // NJS-512: Invalid Connect String Parameters
        case 'NJS-515': // NJS-515: Invalid EZCONNECT Syntax
        case 'NJS-518': // NJS-518: Invald ServiceName
        case 'NJS-519': // NJS-519: Invald SID
          throw new InvalidConnectionError(err);
        case 'ORA-12170': // ORA-12170: TNS: Connect Timeout occurred
        case 'NJS-510': // NJS-510: Connect Timeout occurred

          throw new ConnectionTimedOutError(err);
        default:
          throw new ConnectionError(err);
      }
    }
  }

  async disconnect(connection: OracleConnection) {
    if (!connection.isHealthy()) {
      debug('connection tried to disconnect but was already at CLOSED state');
      return;
    }

    await new Promise<void>((resolve, reject) => {
      connection.close((error) => {
        if (error) {
          return void reject();
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