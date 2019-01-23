'use strict';

const BaseError = require('./base-error');

/**
 * Thrown when a sequelize method is called unbounded. This is done to give something better
 * than `TypeError: cannot read property 'foo' of undefined` that would happen anyway.
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind
 * 
 * @example
 * 
 * ```js
 * // Not OK:
 * someInitialSetupAsync().then(sequelize.sync) // UnboundMethodCallError: Sequelize#sync was called unbounded
 * doSomethingAsync().then(Foo.findAll) // UnboundMethodCallError: Model.findAll was called unbounded
 * Bar.findAll().then(foo.addBars) // UnboundMethodCallError: Model#addBars was called unbounded
 * 
 * // OK:
 * someInitialSetupAsync().then(sequelize.sync.bind(sequelize));
 * someInitialSetupAsync().then(() => sequelize.sync());
 * doSomethingAsync().then(Foo.findAll.bind(Foo));
 * doSomethingAsync().then(() => Foo.findAll());
 * Bar.findAll().then(foo.addBars.bind(foo));
 * Bar.findAll().then(bars => foo.addBars(bars));
 * ```
 * 
 * @extends BaseError
 */
class UnboundMethodCallError extends BaseError {
  constructor(methodName) {
    super(`${methodName} was called unbounded`);
    this.name = 'SequelizeUnboundMethodCallError';
    this.methodName = methodName;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = UnboundMethodCallError;