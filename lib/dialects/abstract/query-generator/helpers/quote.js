/**
 * Quote helpers implement quote ability for all dialects.
 * These are basic block of query building
 *
 * Its better to implement all dialect implementation together here. Which will allow
 * even abstract generator to use them by just specifying dialect type.
 *
 * Defining these helpers in each query dialect will leave
 * code in dual dependency of abstract <-> specific dialect
 */

'use strict';

const Utils = require('../../../../utils');

/**
 *
 * @param {String}  dialect         Dialect name
 * @param {String}  identifier      Identifier to quote
 * @param {Object}  [options]
 * @param {Boolean} [options.force=false]
 * @param {Boolean} [options.quoteIdentifiers=true]
 *
 * @returns {String}
 */
function quoteIdentifier(dialect, identifier, options) {
  if (identifier === '*') return identifier;

  options = Utils.defaults(options || {}, {
    force: false,
    quoteIdentifiers: true
  });

  switch (dialect) {
    case 'sqlite':
      return Utils.addTicks(Utils.removeTicks(identifier, '`'), '`');

    case 'mysql':
      return Utils.addTicks(Utils.removeTicks(identifier, '`'), '`');

    case 'postgres':
      if (
        options.force !== true &&
        options.quoteIdentifiers === false &&
        identifier.indexOf('.') === -1 &&
        identifier.indexOf('->') === -1
      ) {
        // In Postgres, if tables or attributes are created double-quoted,
        // they are also case sensitive. If they contain any uppercase
        // characters, they must always be double-quoted. This makes it
        // impossible to write queries in portable SQL if tables are created in
        // this way. Hence, we strip quotes if we don't want case sensitivity.
        return Utils.removeTicks(identifier, '"');
      } else {
        return Utils.addTicks(Utils.removeTicks(identifier, '"'), '"');
      }

    case 'mssql':
      return '[' + identifier.replace(/[\[\]']+/g, '') + ']';

    default:
      throw new Error(`Dialect "${dialect}" is not supported`);
  }
}
module.exports.quoteIdentifier = quoteIdentifier;

/**
 * Test if a give string is already quoted
 *
 * @param {String} identifier
 *
 * @return Boolean
 */
function isIdentifierQuoted(identifier) {
  return /^\s*(?:([`"'])(?:(?!\1).|\1{2})*\1\.?)+\s*$/i.test(identifier);
}
module.exports.isIdentifierQuoted = isIdentifierQuoted;