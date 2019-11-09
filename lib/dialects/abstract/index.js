'use strict';

class AbstractDialect {}

AbstractDialect.prototype.supports = {
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
    onConflictDoNothing: '' /* dialect specific words for ON CONFLICT DO NOTHING */
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
    functionBased: false
  },
  joinTableDependent: true,
  groupedLimit: true,
  indexViaAlter: false,
  JSON: false,
  deferrableConstraints: false
};

module.exports = AbstractDialect;
module.exports.AbstractDialect = AbstractDialect;
module.exports.default = AbstractDialect;
