import ConnectionManager from './connection-manager.js';
import Query from './query.js';
import QueryGenerator from './query-generator.js';
import DataTypes from '../../data-types.js';

export class PostgresDialect {
  constructor(sequelize) {
    this.sequelize = sequelize;
    this.connectionManager = new ConnectionManager(this, sequelize);
    // QueryGenerator inherits its methods from BaseQueryGenerator via `__proto__`
    this.QueryGenerator = Object.assign(Object.create(QueryGenerator), {
      options: sequelize.options,
      _dialect: this,
      sequelize
    });
  }
}

/**
 * Postgres capabilities, for introspection via `sequelize.dialect.supports`.
 *
 * Nothing in `lib/` branches on these any more -- postgres is the only dialect, so every branch
 * they used to gate had exactly one reachable path and was inlined at the call site. They are kept
 * because they are externally readable API and a number of tests consult them.
 *
 * These describe the *dialect*, not the server version. Behaviour that varies across Postgres
 * releases belongs on `sequelize.options.databaseVersion` (see ConnectionManager, which sniffs it
 * via semver), not here -- a flag flipped here would change behaviour for every version at once.
 */
PostgresDialect.prototype.supports = {
  DEFAULT: true,
  'DEFAULT VALUES': true,
  'VALUES ()': false,
  'LIMIT ON UPDATE': false,
  'ON DUPLICATE KEY': false,
  'ORDER NULLS': true,
  UNION: true,
  'UNION ALL': true,
  IGNORE: '',
  EXCEPTION: true,
  returnValues: {
    returning: true
  },
  autoIncrement: {
    identityInsert: false,
    defaultValue: true,
    update: true
  },
  bulkDefault: true,
  ignoreDuplicates: '',
  updateOnDuplicate: false,
  schemas: true,
  transactions: true,
  transactionOptions: {
    type: false
  },
  migrations: true,
  upserts: true,
  onConflictDoNothing: ' ON CONFLICT DO NOTHING',
  lock: true,
  lockOf: true,
  lockKey: true,
  lockOuterJoinFailure: true,
  forShare: 'FOR SHARE',
  constraints: {
    restrict: true,
    addConstraint: true,
    dropConstraint: true,
    unique: true,
    default: false,
    check: true,
    foreignKey: true,
    primaryKey: true
  },
  index: {
    collate: true,
    length: false,
    parser: false,
    concurrently: true,
    type: false,
    using: 2,
    where: true
  },
  joinTableDependent: true,
  groupedLimit: true,
  indexViaAlter: false,
  NUMERIC: true,
  ARRAY: true,
  RANGE: true,
  GEOMETRY: true,
  REGEXP: true,
  GEOGRAPHY: true,
  JSON: true,
  JSONB: true,
  HSTORE: true,
  deferrableConstraints: true,
  searchPath: true
};

ConnectionManager.prototype.defaultVersion = '17.0.0';
PostgresDialect.prototype.Query = Query;
PostgresDialect.prototype.DataTypes = DataTypes.postgres;
PostgresDialect.prototype.name = 'postgres';
PostgresDialect.prototype.TICK_CHAR = '"';
PostgresDialect.prototype.TICK_CHAR_LEFT = PostgresDialect.prototype.TICK_CHAR;
PostgresDialect.prototype.TICK_CHAR_RIGHT = PostgresDialect.prototype.TICK_CHAR;

export default PostgresDialect;
