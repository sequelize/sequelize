type DialectSupports = {
  'DEFAULT': boolean,
  'DEFAULT VALUES': boolean,
  'VALUES ()': boolean,
  'LIMIT ON UPDATE': boolean,
  'ON DUPLICATE KEY': boolean,
  'ORDER NULLS': boolean,
  'UNION': boolean,
  'UNION ALL': boolean,
  'RIGHT JOIN': boolean,

  /* does the dialect support returning values for inserted/updated fields */
  returnValues: boolean,

  /* features specific to autoIncrement values */
  autoIncrement: {
    /* does the dialect require modification of insert queries when inserting auto increment fields */
    identityInsert: boolean,

    /* does the dialect support inserting default/null values for autoincrement fields */
    defaultValue: boolean,

    /* does the dialect support updating autoincrement fields */
    update: boolean
  },
  /* Do we need to say DEFAULT for bulk insert */
  bulkDefault: boolean,
  schemas: boolean,
  transactions: boolean,
  settingIsolationLevelDuringTransaction: boolean,
  transactionOptions: {
    type: boolean
  },
  migrations: boolean,
  upserts: boolean,
  inserts: {
    ignoreDuplicates: string, /* dialect specific words for INSERT IGNORE or DO NOTHING */
    updateOnDuplicate: boolean, /* whether dialect supports ON DUPLICATE KEY UPDATE */
    onConflictDoNothing: string, /* dialect specific words for ON CONFLICT DO NOTHING */
    conflictFields: boolean /* whether the dialect supports specifying conflict fields or not */
  },
  constraints: {
    restrict: boolean,
    addConstraint: boolean,
    dropConstraint: boolean,
    unique: boolean,
    default: boolean,
    check: boolean,
    foreignKey: boolean,
    primaryKey: boolean
  },
  index: {
    collate: boolean,
    length: boolean,
    parser: boolean,
    concurrently: boolean,
    type: boolean,
    using: boolean,
    functionBased: boolean,
    operator: boolean
  },
  groupedLimit: boolean,
  indexViaAlter: boolean,
  JSON: boolean,
  deferrableConstraints: boolean
};

export class AbstractDialect {
  static readonly supports: DialectSupports = {
    'DEFAULT': true,
    'DEFAULT VALUES': false,
    'VALUES ()': false,
    'LIMIT ON UPDATE': false,
    'ON DUPLICATE KEY': true,
    'ORDER NULLS': false,
    'UNION': true,
    'UNION ALL': true,
    'RIGHT JOIN': true,

    /* does the dialect support returning values for inserted/updated fields */
    returnValues: false,

    /* features specific to autoIncrement values */
    autoIncrement: {
      /* does the dialect require modification of insert queries when inserting auto increment fields */
      identityInsert: false,

      /* does the dialect support inserting default/null values for autoincrement fields */
      defaultValue: true,

      /* does the dialect support updating autoincrement fields */
      update: true
    },
    /* Do we need to say DEFAULT for bulk insert */
    bulkDefault: false,
    schemas: false,
    transactions: true,
    settingIsolationLevelDuringTransaction: true,
    transactionOptions: {
      type: false
    },
    migrations: true,
    upserts: true,
    inserts: {
      ignoreDuplicates: '', /* dialect specific words for INSERT IGNORE or DO NOTHING */
      updateOnDuplicate: false, /* whether dialect supports ON DUPLICATE KEY UPDATE */
      onConflictDoNothing: '', /* dialect specific words for ON CONFLICT DO NOTHING */
      conflictFields: false /* whether the dialect supports specifying conflict fields or not */
    },
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
      concurrently: false,
      type: false,
      using: true,
      functionBased: false,
      operator: false
    },
    groupedLimit: true,
    indexViaAlter: false,
    JSON: false,
    deferrableConstraints: false
  };

  get supports(): DialectSupports {
    const Dialect = this.constructor as typeof AbstractDialect;
    return Dialect.supports;
  }

  // TODO: Replace with QueryGenerator class once its typings are complete.
  declare readonly queryGenerator: unknown;
}
