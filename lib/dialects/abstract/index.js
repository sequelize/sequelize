'use strict';

var AbstractDialect = function() {

};

AbstractDialect.prototype.supports = {
  'DEFAULT': true,
  'DEFAULT VALUES': false,
  'VALUES ()': false,
  'LIMIT ON UPDATE': false,
  'ON DUPLICATE KEY': true,
  'ORDER NULLS': false,
  'UNION': true,
  'UNION ALL': true,
  /* What is the dialect's keyword for INSERT IGNORE */
  'IGNORE': '',

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
  /* The dialect's words for INSERT IGNORE */
  ignoreDuplicates: '',
  /* Does the dialect support ON DUPLICATE KEY UPDATE */
  updateOnDuplicate: false,
  schemas: false,
  transactions: true,
  transactionOptions: {
    type: false
  },
  migrations: true,
  upserts: true,
  constraints: {
    restrict: true
  },
  index: {
    collate: true,
    length: false,
    parser: false,
    concurrently: false,
    type: false,
    using: true,
  },
  joinTableDependent: true,
  groupedLimit: true,
  indexViaAlter: false,
  JSON: false,
  deferrableConstraints: false
};

module.exports = AbstractDialect;
