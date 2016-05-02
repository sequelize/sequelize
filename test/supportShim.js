'use strict';

var QueryInterface = require(__dirname + '/../lib/query-interface')
  , hintsModule = require('hints')
  , _ = require('lodash')
  , util = require('util');

/*
 * Shims all Sequelize methods to test for logging passing.
 * @param {Object} Sequelize Sequelize constructor
 */
module.exports = function(Sequelize) {
  // Shim all Sequelize methods
  shimAll(Sequelize.prototype, 'Sequelize');
  shimAll(Sequelize.Model.prototype, 'Model');
  shimAll(Sequelize.Instance.prototype, 'Instance');
  shimAll(QueryInterface.prototype, 'QueryInterface');
  shimAll(Sequelize.Association.prototype, 'Association');
  _.forIn(Sequelize.Association, function(Association, name) {
    shimAll(Association.prototype, 'Association.' + name);
  });

  // Shim Model.prototype to then shim getter/setter methods
  ['hasOne', 'belongsTo', 'hasMany', 'belongsToMany'].forEach(function(type) {
    shimMethod(Sequelize.Model.prototype, type, function(original) {
      return function(targetModel, options) {
        var model = this,
          association = original.apply(this, arguments);

        _.forIn(association.accessors, function(accessor, accessorName) {
          shim(model.Instance.prototype, accessor, model.Instance.prototype[accessor].length, null, 'Instance#' + accessorName);
        });

        return association;
      };
    });
  });

  // Support functions

  /*
   * Shims all shimmable methods on obj.
   * @param {Object} obj
   * @param {String} objName Name of object for error reporting
   */
  function shimAll(obj, objName) {
    _.forIn(obj, function(method, name) {
      var result = examine(method, name);
      if (result) shim(obj, name, result.index, result.conform, objName + '#' + name);
    });
  }

  /*
   * Given a function, checks whether is suitable for shimming to modify `options`
   * and returns information about how to do that
   *
   * Returns an object in form:
   * {
   *   index: [which argument of function is `options`],
   *   conform: [function for conforming the arguments if function accepts flexible options]
   * }
   *
   * index is 1-based (i.e. 1st argument = 1)
   *
   * If method should not be shimmed, returns undefined
   *
   * It works out if a method can be shimmed based on:
   * 1. If method name begins with lower case letter (skip classes and $/_ internals)
   * 2. If one of function's arguments is called 'options'
   * 3. Overiden by hints in function body
   *   `// testhint options:none` - skips shimming this function
   *   `// testhint options:2` - 2nd function argument is the `options` parameter (first arg = 1)
   *   `// testhint argsConform.start` & `// testhint argsConform.end`
   *     - this part of the function body deals with conforming flexible arguments
   *
   * @param {Function} method Function to examine
   * @param {String} name Attribute name of this method on parent object
   * @returns {Object}
   */
  function examine(method, name) {
    if (typeof method !== 'function') return;

    // find test hints if provided
    var obj = hintsModule.full(method.toString(), 'testhint', {function: true}),
      hints = obj.hints,
      tree = obj.tree;

    var result = {};

    // extract function arguments
    var args = getFunctionArguments(tree);

    // create args conform function
    result.conform = getArgumentsConformFn(method, args, obj.hintsPos, tree);

    // use hints to find index
    var hint = hints.options;
    if (hint === 'none') return;
    if (hint && hint.match(/^\d+$/)) {
      result.index = hint * 1;
      return result;
    }

    // skip if function name does not start with lower case letter
    if (!name.match(/^[a-z]/)) return;

    // find 'options' argument - if none, then skip
    var index = args.indexOf('options');
    if (index === -1) return;

    result.index = index + 1;
    return result;
  }

  /*
   * Shims a method to check for `options.logging`.
   * The method then:
   *   Injects `options.logging` if called from within the tests.
   *   Throws if called from within Sequelize and not passed correct `options.logging`
   *
   * @param {Object} obj Object which is parent of this method
   * @param {String} name Name of method on object to shim
   * @param {Integer} index Index of argument which is `options` (1-based)
   * @param {Function} conform Function to conform function arguments
   * @param {String} debugName Full name of method for error reporting
   */
  function shim(obj, name, index, conform, debugName) {
    index--;

    shimMethod(obj, name, function(original) {
      var sequelizeProto = (obj === Sequelize.prototype);

      return function() {
        var sequelize = (sequelizeProto ? this : this.sequelize);

        var args = Sequelize.Utils.sliceArgs(arguments),
          originalOptions,
          fromTests = calledFromTests();

        if (conform) args = conform.apply(this, arguments);

        var options = args[index];

        if (fromTests) {
          args[index] = options = addLogger(options, sequelize);
          originalOptions = cloneOptions(options);
        } else {
          testLogger(options, debugName);
        }

        var result = original.apply(this, args);
        if (fromTests) {
          checkOptions(options, originalOptions, debugName);
          if (result instanceof Sequelize.Promise) {
            result = result.finally(function() {
              checkOptions(options, originalOptions, debugName);
              removeLogger(options);
            });
          } else {
            removeLogger(options);
          }
        }
        return result;
      };
    });
  }

  /*
   * Shims a method with given wrapper function
   *
   * @param {Object} obj Object which is parent of this method
   * @param {String} name Name of method on object to shim
   * @param {Function} wrapper Wrapper function
   */
  function shimMethod(obj, name, wrapper) {
    var original = obj[name];
    if (original.__testShim) return;

    if (original.__testShimmedTo) {
      obj[name] = original.__testShimmedTo;
    } else {
      obj[name] = wrapper(original);
      obj[name].__testShim = original;
      original.__testShimmedTo = obj[name];
    }
  }

  /*
   * Adds `logging` function to `options`.
   * If existing `logging` attribute, shims it.
   *
   * @param {Object} options
   * @returns {Object} Options with `logging` attribute added
   */
  function addLogger(options, sequelize) {
    if (!options) options = {};

    var hadLogging = options.hasOwnProperty('logging'),
      originalLogging = options.logging;

    options.logging = function() {
      var logger = originalLogging !== undefined ? originalLogging : sequelize.options.logging;
      if (logger) {
        if ((sequelize.options.benchmark || options.benchmark) && logger === console.log) {
          return logger.call(this, arguments[0] + ' Elapsed time: ' + arguments[1] + 'ms');
        } else {
          return logger.apply(this, arguments);
        }
      }
    };

    options.logging.__testLoggingFn = true;
    if (hadLogging) options.logging.__originalLogging = originalLogging;

    return options;
  }

  /*
   * Revert `options.logging` to original value
   *
   * @param {Object} options
   * @returns {Object} Options with `logging` attribute reverted to original value
   */
  function removeLogger(options) {
    if (options.logging.hasOwnProperty('__originalLogging')) {
      options.logging = options.logging.__originalLogging;
    } else {
      delete options.logging;
    }
  }

  /*
   * Checks if `options.logging` is an injected logging function
   *
   * @param {Object} options
   * @throws {Error} Throws if `options.logging` is not a shimmed logging function
   */
  function testLogger(options, name) {
    if (!options || !options.logging || !options.logging.__testLoggingFn) throw new Error('options.logging has been lost in method ' + name);
  }

  /*
   * Checks if this method called from the tests
   * (as opposed to being called within Sequelize codebase).
   *
   * @returns {Boolean} true if this method called from within the tests
   */
  var pathRegStr = _.escapeRegExp(__dirname + '/'),
    regExp = new RegExp('^\\s+at\\s+(' + pathRegStr + '|.+ \\(' + pathRegStr + ')');

  function calledFromTests() {
    return !!((new Error()).stack.split(/[\r\n]+/)[3].match(regExp));
  }
};

// Helper functions for examining code for hints

/*
 * Returns arguments of a function as an array, from it's AST
 *
 * @tree {Object} tree Abstract syntax tree of function's code
 * @returns {Array} Array of names of `method`'s arguments
 */
function getFunctionArguments(tree) {
  return tree.body[0].params.map(function(param) {return param.name;});
}

/*
 * Extracts conform arguments section from function body and turns into function.
 * That function is called with the same signature as the original function,
 * conforms them into the standard order, and returns the arguments as an array.
 *
 * Returns undefined if no conform arguments hints.
 *
 * @param {Function} method Function to inspect
 * @param {Array} args Array of names of `method`'s arguments
 * @param {Object} hints Hints object containing code hints parsed from code
 * @tree {Object} tree Abstract syntax tree of function's code
 * @returns {Function} Function which will conform method's arguments and return as an array
 */
function getArgumentsConformFn(method, args, hints, tree) {
  // check if argsConform hints present
  hints = hints.argsConform;
  if (!hints) return;
  if (hints.start && !hints.end) throw new Error('Options conform section has no end');
  if (!hints.end) return;

  // extract
  var start = hints.start ? hints.start.end : tree.body[0].body.start + 1,
    body = method.toString().slice(start, hints.end.start);

  // create function that conforms arguments
  return new Function(args, body + ';return [' + args + '];'); // jshint ignore:line
}

/*
 * Clone options object
 * @params {Object} options - Options object
 * @returns {Object} Clone of options
 */
function cloneOptions(options) {
  return _.cloneDeepWith(options, function(value) {
    if (typeof value === 'object' && !_.isPlainObject(value)) return value;
  });
}

/*
 * Checks options object has not been altered and throw if altered
 *
 * @params {Object} options - Options object
 * @params {Object} original - Original options object
 * @throws {Error} Throws if options and original are not identical
 */
function checkOptions(options, original, name) {
  if (!optionsEqual(options, original)) throw new Error('options modified in ' + name + ', input: ' + util.inspect(original) + ' output: ' + util.inspect(options));
}

/*
 * Compares two options objects and returns if they are deep equal to each other.
 * Objects which are not plain objects (e.g. Models) are compared by reference.
 * Everything else deep-compared by value.
 *
 * @params {Object} options - Options object
 * @params {Object} original - Original options object
 * @returns {Boolean} true if options and original are same, false if not
 */
function optionsEqual(options, original) {
  return _.isEqualWith(options, original, function(value1, value2) {
    if ((typeof value1 === 'object' && !_.isPlainObject(value1)) || (typeof value2 === 'object' && !_.isPlainObject(value2))) return value1 === value2;
  });
}
