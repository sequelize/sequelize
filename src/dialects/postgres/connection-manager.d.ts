import { AbstractConnectionManager } from '../abstract/connection-manager.js';

export class PostgresConnectionManager extends AbstractConnectionManager {
  nameOidMap: Record<string, {
    oid: number,
    arrayOid: number,
  }>;
}
