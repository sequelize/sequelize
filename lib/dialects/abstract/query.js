var Utils              = require('../../utils')
  , CustomEventEmitter = require("../../emitters/custom-event-emitter")

module.exports = (function() {
  var AbstractQuery = function(database, sequelize, callee, options) {

  }

  /**
    Inherit from CustomEventEmitter
  */
  Utils.inherit(AbstractQuery, CustomEventEmitter)

  /**
   * Execute the passed sql query.
   *
   * Examples:
   *
   *     query.run('SELECT 1')
   *
   * @param {String} sql - The SQL query which should be executed.
   * @api public
   */
  AbstractQuery.prototype.run = function(sql) {
    throw new Error("The run method wasn't overwritten!")
  }

  AbstractQuery.prototype.formatResults = function() {
    this.emit('fnord', 1)
  }

  /**
    Shortcut methods (success, ok) for listening for success events.

    Params:
      - fct: A function that gets executed once the *success* event was triggered.

    Result:
      The function returns the instance of the query.
  */
  AbstractQuery.prototype.success =
  AbstractQuery.prototype.ok =
  function(fct) {
    this.on('success', fct)
    return this
  }

  /**
    Shortcut methods (failure, fail, error) for listening for error events.

    Params:
      - fct: A function that gets executed once the *error* event was triggered.

    Result:
      The function returns the instance of the query.
  */
  AbstractQuery.prototype.failure =
  AbstractQuery.prototype.fail =
  AbstractQuery.prototype.error =
  function(fct) {
    this.on('error', fct)
    return this
  }

  return AbstractQuery
})()
