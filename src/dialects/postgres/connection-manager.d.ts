import { ConnectionManager } from '../abstract/connection-manager.js';

export class PostgresConnectionManager extends ConnectionManager {
  nameOidMap: Record<string, {
    oid: number,
    arrayOid: number,
  }>;
}
