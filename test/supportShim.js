'use strict';

const QueryInterface = require(__dirname + '/../lib/query-interface'),
  hintsModule = require('hints'),
  _ = require('lodash'),
  util = require('util');

/**
 * Shims all Sequelize methods to test for logging passing.
 * @param {Object} Sequelize - Sequelize constructor
 */
module.exports = function(Sequelize) {
  // Shim all Sequelize methods
  shimAll(Sequelize.prototype, 'Sequelize#');
  shimAll(Sequelize.Model, 'Model.');
  shimAll(Sequelize.Model.prototype, 'Model#');
  shimAll(QueryInterface.prototype, 'QueryInterface#');
  shimAll(Sequelize.Association.prototype, 'Association#');
  _.forIn(Sequelize.Association, (Association, name) => {
    shimAll(Association.prototype, 'Association.' + name + '#');
  });

  // Shim Model static methods to then shim getter/setter methods
  ['hasOne', 'belongsTo', 'hasMany', 'belongsToMany'].forEach(type => {
    shimMethod(Sequelize.Model, type, original => {
      return function() {
        const model = this,
          association = original.apply(this, arguments);

        _.forIn(association.accessors, (accessor, accessorName) => {
          shim(model.prototype, accessor, model.prototype[accessor].length, null, 'Model#' + accessorName);
        });

        return association;
      };
    });
  });

  // Support functions

  /**
   * Shims all shimmable methods on obj.
   * @param {Object} obj
   * @param {string} objName - Name of object for error reporting
   */
  function shimAll(obj, objName) {
    forOwn(obj, (method, name) => {
      const result = examine(method, name);
      if (result) shim(obj, name, result.index, result.conform, objName + name);
    });
  }

  /**
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
   * @param {Function} method - Function to examine
   * @param {string} name - Attribute name of this method on parent object
   * @returns {Object}
   */
  function examine(method, name) {
    // skip if not a function
    if (typeof method !== 'function') return;

    // skip classes, constructors and private methods
    if (name === 'constructor' || !name.match(/^[a-z]/)) return;

    // find test hints if provided
    const fnStr = getFunctionCode(method),
      obj = hintsModule.full(fnStr, 'testhint'),
      hints = obj.hints,
      tree = obj.tree;

    const result = {};

    // extract function arguments
    const args = getFunctionArguments(tree);

    // create args conform function
    result.conform = getArgumentsConformFn(method, args, obj.hintsPos, tree);

    // use hints to find index
    const hint = hints.options;
    if (hint === 'none') return;
    if (hint && hint.match(/^\d+$/)) {
      result.index = hint * 1;
      return result;
    }

    // find 'options' argument - if none, then skip
    const index = args.indexOf('options');
    if (index === -1) return;

    result.index = index + 1;
    return result;
  }

  /**
   * Shims a method to check for `options.logging`.
   * The method then:
   *   Injects `options.logging` if called from within the tests.
   *   Throws if called from within Sequelize and not passed correct `options.logging`
   *
   * @param {Object} obj - Object which is parent of this method
   * @param {string} name - Name of method on object to shim
   * @param {number} index - Index of argument which is `options` (1-based)
   * @param {Function} conform - Function to conform function arguments
   * @param {string} debugName - Full name of method for error reporting
   */
  function shim(obj, name, index, conform, debugName) {
    index--;

    shimMethod(obj, name, original => {
      const sequelizeProto = obj === Sequelize.prototype;

      return function() {
        let sequelize = sequelizeProto ? this : this.sequelize;
        if (this instanceof Sequelize.Association) sequelize = this.target.sequelize;
        if (!sequelize) throw new Error('Object does not have a `sequelize` attribute');

        let args = Sequelize.Utils.sliceArgs(arguments);
        const fromTests = calledFromTests();

        if (conform) args = conform.apply(this, arguments);

        let options = args[index];

        if (fromTests) {
          args[index] = options = addLogger(options, sequelize);
        } else {
          testLogger(options, debugName);
        }

        const originalOptions = cloneOptions(options);

        let result = original.apply(this, args);

        if (result && typeof result.then === 'function') {
          let err;
          try {
            checkOptions(options, originalOptions, debugName);
          } catch (e) {
            err = e;
          }

          if (!(result instanceof Sequelize.Promise)) {
            result = Sequelize.Promise.resolve(result);
            err = new Error('Promise returned by ' + debugName + ' is not instance of Sequelize.Promise');
          }

          result = result.finally(() => {
            if (err) throw err;
            checkOptions(options, originalOptions, debugName);
            if (fromTests) removeLogger(options);
          });
        } else {
          checkOptions(options, originalOptions, debugName);
          if (fromTests) removeLogger(options);
        }

        return result;
      };
    });
  }

  /**
   * Shims a method with given wrapper function
   *
   * @param {Object} obj - Object which is parent of this method
   * @param {string} name - Name of method on object to shim
   * @param {Function} wrapper - Wrapper function
   */
  function shimMethod(obj, name, wrapper) {
    const original = obj[name];
    if (original.__testShim) return;

    if (original.__testShimmedTo) {
      obj[name] = original.__testShimmedTo;
    } else {
      obj[name] = wrapper(original);
      obj[name].__testShim = original;
      original.__testShimmedTo = obj[name];
    }
  }

  /**
   * Adds `logging` function to `options`.
   * If existing `logging` attribute, shims it.
   *
   * @param {Object} options
   * @returns {Object} - Options with `logging` attribute added
   */
  function addLogger(options, sequelize) {
    if (!options) options = {};

    const hadLogging = options.hasOwnProperty('logging'),
      originalLogging = options.logging;

    options.logging = function() {
      const logger = originalLogging !== undefined ? originalLogging : sequelize.options.logging;
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

  /**
   * Revert `options.logging` to original value
   *
   * @param {Object} options
   * @returns {Object} - Options with `logging` attribute reverted to original value
   */
  function removeLogger(options) {
    if (options.logging.hasOwnProperty('__originalLogging')) {
      options.logging = options.logging.__originalLogging;
    } else {
      delete options.logging;
    }
  }

  /**
   * Checks if `options.logging` is an injected logging function
   *
   * @param {Object} options
   * @throws {Error} - Throws if `options.logging` is not a shimmed logging function
   */
  function testLogger(options, name) {
    if (!options || !options.logging || !options.logging.__testLoggingFn) throw new Error('options.logging has been lost in method ' + name);
  }

  /**
   * Checks if this method called from the tests
   * (as opposed to being called within Sequelize codebase).
   *
   * @returns {boolean} - true if this method called from within the tests
   */
  const pathRegStr = _.escapeRegExp(__dirname + '/'),
    regExp = new RegExp('^\\s+at\\s+(' + pathRegStr + '|.+ \\(' + pathRegStr + ')');

  function calledFromTests() {
    return !!(new Error()).stack.split(/[\r\n]+/)[3].match(regExp);
  }
};

// Helper functions for examining code for hints

/**
 * Loop through own properties of object (including non-enumerable properties)
 * and call `fn` for each property with argments `(value, key, object)`.
 * Getters are skipped.
 * Like `_.forIn()` except also includes non-enumarable properties, and skips getters.
 *
 * @param {Object} obj - Object to iterate over
 * @param {Function} fn - Function to call for each property
 * @returns {Object} - `obj` input
 */
function forOwn(obj, fn) {
  Object.getOwnPropertyNames(obj).forEach(key => {
    if (Object.getOwnPropertyDescriptor(obj, key).hasOwnProperty('value')) fn(obj[key], key, obj);
  });
  return obj;
}

/**
 * Get code of function
 * Adds 'function ' to start of code where fn has been defined with object method shortcut,
 * and alters illegal function names ('import', 'delete'), so code can be parsed by `acorn`.
 *
 * @param {Function} fn - Function
 * @returns {string} - Code of function
 */
function getFunctionCode(fn) {
  let code = fn.toString();
  if (code.match(/^function[\s\*\(]/) || code.match(/^class[\s\{]/)) return code;
  if (code.match(/^(import|delete)[\s\*\(]/)) code = '_' + code.substr(1);
  return 'function ' + code;
}

/**
 * Returns arguments of a function as an array, from its AST
 *
 * @param {Object} tree - Abstract syntax tree of function's code
 * @returns {Array} - Array of names of `method`'s arguments
 */
function getFunctionArguments(tree) {
  return tree.body[0].params.map(param => {return param.name;});
}

/**
 * Extracts conform arguments section from function body and turns into function.
 * That function is called with the same signature as the original function,
 * conforms them into the standard order, and returns the arguments as an array.
 *
 * Returns undefined if no conform arguments hints.
 *
 * @param {Function} method - Function to inspect
 * @param {Array} args - Array of names of `method`'s arguments
 * @param {Object} hints - Hints object containing code hints parsed from code
 * @param {Object} tree - Abstract syntax tree of function's code
 * @returns {Function} - Function which will conform method's arguments and return as an array
 */
function getArgumentsConformFn(method, args, hints, tree) {
  // check if argsConform hints present
  hints = hints.argsConform;
  if (!hints) return;
  if (hints.start && !hints.end) throw new Error('Options conform section has no end');
  if (!hints.end) return;

  // extract
  const start = hints.start ? hints.start.end : tree.body[0].body.start + 1,
    body = getFunctionCode(method).slice(start, hints.end.start);

  // create function that conforms arguments
  return new Function(args, body + ';return [' + args + '];');
}

/**
 * Clone options object
 * @param {Object} options - Options object
 * @returns {Object} - Clone of options
 */
function cloneOptions(options) {
  return _.cloneDeepWith(options, value => {
    if (typeof value === 'object' && !_.isPlainObject(value)) return value;
  });
}

/**
 * Checks options object has not been altered and throw if altered
 *
 * @param {Object} options - Options object
 * @param {Object} original - Original options object
 * @throws {Error} - Throws if options and original are not identical
 */
function checkOptions(options, original, name) {
  if (!optionsEqual(options, original)) throw new Error('options modified in ' + name + ', input: ' + util.inspect(original) + ' output: ' + util.inspect(options));
}

/**
 * Compares two options objects and returns if they are deep equal to each other.
 * Objects which are not plain objects (e.g. Models) are compared by reference.
 * Everything else deep-compared by value.
 *
 * @param {Object} options - Options object
 * @param {Object} original - Original options object
 * @returns {boolean} - true if options and original are same, false if not
 */
function optionsEqual(options, original) {
  return _.isEqualWith(options, original, (value1, value2) => {
    if (typeof value1 === 'object' && !_.isPlainObject(value1) || typeof value2 === 'object' && !_.isPlainObject(value2)) return value1 === value2;
  });
}
