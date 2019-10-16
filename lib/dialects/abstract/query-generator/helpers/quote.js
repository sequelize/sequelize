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
 *
 * @private
 */
const postgresReservedWords = 'all,analyse,analyze,and,any,array,as,asc,asymmetric,authorization,binary,both,case,cast,check,collate,collation,column,concurrently,constraint,create,cross,current_catalog,current_date,current_role,current_schema,current_time,current_timestamp,current_user,default,deferrable,desc,distinct,do,else,end,except,false,fetch,for,foreign,freeze,from,full,grant,group,having,ilike,in,initially,inner,intersect,into,is,isnull,join,lateral,leading,left,like,limit,localtime,localtimestamp,natural,not,notnull,null,offset,on,only,or,order,outer,overlaps,placing,primary,references,returning,right,select,session_user,similar,some,symmetric,table,tablesample,then,to,trailing,true,union,unique,user,using,variadic,verbose,when,where,window,with'.split(',');

/**
 *
 * @param {string}  dialect         Dialect name
 * @param {string}  identifier      Identifier to quote
 * @param {Object}  [options]
 * @param {boolean} [options.force=false]
 * @param {boolean} [options.quoteIdentifiers=true]
 *
 * @returns {string}
 * @private
 */
function quoteIdentifier(dialect, identifier, options) {
  if (identifier === '*') return identifier;

  options = Utils.defaults(options || {}, {
    force: false,
    quoteIdentifiers: true
  });

  let initialIdentifier = identifier;
  let literalAttribute = null;

  if (Array.isArray(identifier)) {
    literalAttribute = identifier[0];
    initialIdentifier = identifier[1];
  }

  switch (dialect) {
    case 'sqlite':
    case 'mariadb':
    case 'mysql':
      if (literalAttribute) {
        return `${literalAttribute.val} AS ${Utils.addTicks(Utils.removeTicks(initialIdentifier, '`'), '`')}`;
      }

      return Utils.addTicks(Utils.removeTicks(initialIdentifier, '`'), '`');

    case 'postgres':
      // In Postgres, if tables or attributes are created double-quoted,
      // they are also case sensitive. If they contain any uppercase
      // characters, they must always be double-quoted. This makes it
      // impossible to write queries in portable SQL if tables are created in
      // this way. Hence, we strip quotes if we don't want case sensitivity.
      const shouldBeLeftUnticked = (field, untickedField) => Boolean(
        options.force !== true &&
        options.quoteIdentifiers === false &&
        !field.includes('.') &&
        !field.includes('->') &&
        !postgresReservedWords.includes(untickedField.toLowerCase())
      );

      if (literalAttribute) {
        const untickedField = Utils.removeTicks(initialIdentifier, '"');
        const field = shouldBeLeftUnticked(initialIdentifier, untickedField)
          ? untickedField
          : Utils.addTicks(untickedField, '"');

        return `${literalAttribute.val} AS ${field}`;
      }

      const untickedAttribute = Utils.removeTicks(initialIdentifier, '"');

      return shouldBeLeftUnticked(initialIdentifier, untickedAttribute)
        ? untickedAttribute
        : Utils.addTicks(untickedAttribute, '"');

    case 'mssql':
      return literalAttribute
        ? `${literalAttribute.val} AS ${`[${initialIdentifier.replace(/[[\]']+/g, '')}]`}`
        : `[${initialIdentifier.replace(/[[\]']+/g, '')}]`;

    default:
      throw new Error(`Dialect "${dialect}" is not supported`);
  }
}
module.exports.quoteIdentifier = quoteIdentifier;

/**
 * Test if a give string is already quoted
 *
 * @param {string} identifier
 *
 * @returns {boolean}
 * @private
 */
function isIdentifierQuoted(identifier) {
  return /^\s*(?:([`"'])(?:(?!\1).|\1{2})*\1\.?)+\s*$/i.test(identifier);
}
module.exports.isIdentifierQuoted = isIdentifierQuoted;
