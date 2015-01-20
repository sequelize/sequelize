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

  schemas: false,
  transactions: true,
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
  joinTableDependent: true
};

module.exports = AbstractDialect;
