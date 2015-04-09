'use strict';

var Utils = require('../../utils');

/**
 Returns an object that treats SQLite's inabilities to do certain queries.

 @class QueryInterface
 @static
 */
module.exports = {
  /**
    A wrapper that fixes SQLite's inability to remove columns from existing tables.
    It will create a backup of the table, drop the table afterwards and create a
    new table with the same name but without the obsolete column.

    @method removeColumn
    @for    QueryInterface

    @param  {String} tableName     The name of the table.
    @param  {String} attributeName The name of the attribute that we want to remove.
    @param  {CustomEventEmitter} emitter       The EventEmitter from outside.
    @param  {Function} queryAndEmit  The function from outside that triggers some events to get triggered.

    @since 1.6.0
   */
  removeColumn: function(tableName, attributeName) {
    var self = this;
    return this.describeTable(tableName).then(function(fields) {
      delete fields[attributeName];

      var sql = self.QueryGenerator.removeColumnQuery(tableName, fields)
        , subQueries = sql.split(';').filter(function(q) { return q !== ''; });

      return Utils.Promise.reduce(subQueries, function(total, subQuery) {
        return self.sequelize.query(subQuery + ';', null, { raw: true});
      }, null);
    });
  },

  /**
    A wrapper that fixes SQLite's inability to change columns from existing tables.
    It will create a backup of the table, drop the table afterwards and create a
    new table with the same name but with a modified version of the respective column.

    @method changeColumn
    @for    QueryInterface

    @param  {String} tableName The name of the table.
    @param  {Object} attributes An object with the attribute's name as key and it's options as value object.
    @param  {CustomEventEmitter} emitter The EventEmitter from outside.
    @param  {Function} queryAndEmit The function from outside that triggers some events to get triggered.

    @since 1.6.0
   */
  changeColumn: function(tableName, attributes) {
    var attributeName = Utils._.keys(attributes)[0]
      , self = this;

    return this.describeTable(tableName).then(function(fields) {
      fields[attributeName] = attributes[attributeName];

      var sql = self.QueryGenerator.removeColumnQuery(tableName, fields)
        , subQueries = sql.split(';').filter(function(q) { return q !== ''; });

      return Utils.Promise.reduce(subQueries, function(total, subQuery) {
        return self.sequelize.query(subQuery + ';', null, { raw: true});
      }, null);
    });
  },

  /**
    A wrapper that fixes SQLite's inability to rename columns from existing tables.
    It will create a backup of the table, drop the table afterwards and create a
    new table with the same name but with a renamed version of the respective column.

    @method renameColumn
    @for    QueryInterface

    @param  {String} tableName The name of the table.
    @param  {String} attrNameBefore The name of the attribute before it was renamed.
    @param  {String} attrNameAfter The name of the attribute after it was renamed.
    @param  {CustomEventEmitter} emitter The EventEmitter from outside.
    @param  {Function} queryAndEmit The function from outside that triggers some events to get triggered.

    @since 1.6.0
   */
  renameColumn: function(tableName, attrNameBefore, attrNameAfter) {
    var self = this;
    return this.describeTable(tableName).then(function(fields) {
      fields[attrNameAfter] = Utils._.clone(fields[attrNameBefore]);
      delete fields[attrNameBefore];

      var sql = self.QueryGenerator.renameColumnQuery(tableName, attrNameBefore, attrNameAfter, fields)
        , subQueries = sql.split(';').filter(function(q) { return q !== ''; });

      return Utils.Promise.reduce(subQueries, function(total, subQuery) {
        return self.sequelize.query(subQuery + ';', null, { raw: true});
      }, null);
    });
  }
};
