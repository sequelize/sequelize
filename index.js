/**
  The entry point.
  @module Sequelize
**/
var Sequelize=require("./lib/sequelize")
  , Utils = require('./lib/utils')
  , Promise = require('./lib/promise')
  , QueryTypes = require('./lib/query-types');


  Sequelize.prototype.authenticate = function(options) {
    var sql='SELECT 1+1 AS result';
    if (this.options.dialect==="oracle"){
  	  sql+=' FROM dual';
    }
    return this.query(sql, Utils._.assign({ raw: true, plain: true }, options)).return().catch(function(err) {
      throw new Error(err);
    });
  };

  Sequelize.prototype.validate = Sequelize.prototype.authenticate;

  /**
   * Execute a query on the DB, with the posibility to bypass all the sequelize goodness.
   *
   * By default, the function will return two arguments: an array of results, and a metadata object, containing number of affected rows etc. Use `.spread` to access the results.
   *
   * If you are running a type of query where you don't need the metadata, for example a `SELECT` query, you can pass in a query type to make sequelize format the results:
   *
   * ```js
   * sequelize.query('SELECT...').spread(function (results, metadata) {
   *   // Raw query - use spread
   * });
   *
   * sequelize.query('SELECT...', { type: sequelize.QueryTypes.SELECT }).then(function (results) {
   *   // SELECT query - use then
   * })
   * ```
   *
   * @method query
   * @param {String}          sql
   * @param {Object}          [options={}] Query options.
   * @param {Boolean}         [options.raw] If true, sequelize will not try to format the results of the query, or build an instance of a model from the result
   * @param {Transaction}     [options.transaction=null] The transaction that the query should be executed under
   * @param {String}          [options.type='RAW'] The type of query you are executing. The query type affects how results are formatted before they are passed back. The type is a string, but `Sequelize.QueryTypes` is provided as convenience shortcuts.
   * @param {Boolean}         [options.nest=false] If true, transforms objects with `.` separated property names into nested objects using [dottie.js](https://github.com/mickhansen/dottie.js). For example { 'user.username': 'john' } becomes { user: { username: 'john' }}. When `nest` is true, the query type is assumed to be `'SELECT'`, unless otherwise specified
   * @param {Boolean}         [options.plain=false] Sets the query type to `SELECT` and return a single row
   * @param {Object|Array}    [options.replacements] Either an object of named parameter replacements in the format `:param` or an array of unnamed replacements to replace `?` in your SQL.
   * @param {Boolean}         [options.useMaster=false] Force the query to use the write pool, regardless of the query type.
   * @param {Function}        [options.logging=false] A function that gets executed while running the query to log the sql.
   * @param {Instance}        [options.instance] A sequelize instance used to build the return instance
   * @param {Model}           [options.model] A sequelize model used to build the returned model instances (used to be called callee)
   *
   * @return {Promise}
   *
   * @see {Model#build} for more information about instance option.
   */
  Sequelize.prototype.query = function(sqlQuery, options) {
    //add for oracle
    var sql;
    if(typeof sqlQuery === 'object' && sqlQuery.sql){
      sql=sqlQuery.sql;
      options.bind=sqlQuery.bind;
    }else{
      sql=sqlQuery;
    }
    
    if (arguments.length > 2) {
      // TODO: Remove this note in the next major version (4.0)
      throw new Error('Sequelize.query was refactored to only use the parameters `sql` and `options`. Please read the changelog about BC.');
    }

    var self = this;

    options = options || {};

    if (options.instance && !options.model) {
      options.model = options.instance.Model;
    }

    if (Utils._.isPlainObject(sql)) {
      if (sql.values !== undefined) {
        if (options.replacements !== undefined) {
          throw new Error('Both `sql.values` and `options.replacements` cannot be set at the same time');
        }

        options.replacements = sql.values;
      }

      if (sql.query !== undefined) {
        sql = sql.query;
      }
    }

    sql = sql.trim();

    if (!options.instance && !options.model) {
      options.raw = true;
    }

    if (options.replacements) {
      if (Array.isArray(options.replacements)) {
        sql = Utils.format([sql].concat(options.replacements), this.options.dialect);
      }
      else {
        sql = Utils.formatNamedParameters(sql, options.replacements, this.options.dialect);
      }
    }

    options = Utils._.extend(Utils._.clone(this.options.query), options);
    options = Utils._.defaults(options, {
      logging: this.options.hasOwnProperty('logging') ? this.options.logging : console.log
    });

    if (options.transaction === undefined && Sequelize.cls) {
      options.transaction = Sequelize.cls.get('transaction');
    }

    if (!options.type) {
      if (options.model || options.nest || options.plain) {
        options.type = QueryTypes.SELECT;
      } else {
        options.type = QueryTypes.RAW;
      }
    }

    if (options.transaction && options.transaction.finished) {
      return Promise.reject(options.transaction.finished+' has been called on this transaction('+options.transaction.id+'), you can no longer use it');
    }

    if (this.test.$trackRunningQueries) {
      this.test.$runningQueries++;
    }

    return Promise.resolve(
      options.transaction ? options.transaction.connection : self.connectionManager.getConnection(options)
    ).then(function (connection) {
      var query = new self.dialect.Query(connection, self, options);
      return query.run(sql).finally(function() {
        if (options.transaction) return;
        return self.connectionManager.releaseConnection(connection);
      });
    }).finally(function () {
      if (self.test.$trackRunningQueries) {
        self.test.$runningQueries--;
      }
    });
  };

module.exports = Sequelize