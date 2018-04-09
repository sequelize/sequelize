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
 * list of reserved words in PostgreSQL 10
 * source: https://www.postgresql.org/docs/10/static/sql-keywords-appendix.html
 */
const postgresReservedWords = 'all,analyse,analyze,and,any,array,as,asc,asymmetric,authorization,binary,both,case,cast,check,collate,collation,column,concurrently,constraint,create,cross,current_catalog,current_date,current_role,current_schema,current_time,current_timestamp,current_user,default,deferrable,desc,distinct,do,else,end,except,false,fetch,for,foreign,freeze,from,full,grant,group,having,ilike,in,initially,inner,intersect,into,is,isnull,join,lateral,leading,left,like,limit,localtime,localtimestamp,natural,not,notnull,null,offset,on,only,or,order,outer,overlaps,placing,primary,references,returning,right,select,session_user,similar,some,symmetric,table,tablesample,then,to,trailing,true,union,unique,user,using,variadic,verbose,when,where,window,with'.split(',');

/**
 *
 * @param {String}  dialect         Dialect name
 * @param {String}  identifier      Identifier to quote
 * @param {Object}  [options]
 * @param {Boolean} [options.force=false]
 * @param {Boolean} [options.quoteIdentifiers=true]
 *
 * @returns {String}
 * @private
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
      const rawIdentifier = Utils.removeTicks(identifier, '"');

      if (
        options.force !== true &&
        options.quoteIdentifiers === false &&
        identifier.indexOf('.') === -1 &&
        identifier.indexOf('->') === -1 &&
        postgresReservedWords.indexOf(rawIdentifier.toLowerCase()) === -1
      ) {
        // In Postgres, if tables or attributes are created double-quoted,
        // they are also case sensitive. If they contain any uppercase
        // characters, they must always be double-quoted. This makes it
        // impossible to write queries in portable SQL if tables are created in
        // this way. Hence, we strip quotes if we don't want case sensitivity.
        return rawIdentifier;
      } else {
        return Utils.addTicks(rawIdentifier, '"');
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
 * @private
 */
function isIdentifierQuoted(identifier) {
  return /^\s*(?:([`"'])(?:(?!\1).|\1{2})*\1\.?)+\s*$/i.test(identifier);
}
module.exports.isIdentifierQuoted = isIdentifierQuoted;