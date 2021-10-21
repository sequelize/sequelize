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
 * list of reserved words in Snowflake
 * source: https://docs.snowflake.com/en/sql-reference/reserved-keywords.html
 * 
 * @private
 */
const snowflakeReservedWords = 'account,all,alter,and,any,as,between,by,case,cast,check,column,connect,connections,constraint,create,cross,current,current_date,current_time,current_timestamp,current_user,database,delete,distinct,drop,else,exists,false,following,for,from,full,grant,group,gscluster,having,ilike,in,increment,inner,insert,intersect,into,is,issue,join,lateral,left,like,localtime,localtimestamp,minus,natural,not,null,of,on,or,order,organization,qualify,regexp,revoke,right,rlike,row,rows,sample,schema,select,set,some,start,table,tablesample,then,to,trigger,true,try_cast,union,unique,update,using,values,view,when,whenever,where,with'.split(',');

/**
 *
 * @param {string}  dialect         Dialect name
 * @param {string}  identifier      Identifier to quote
 * @param {object}  [options]
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

  switch (dialect) {
    case 'sqlite':
    case 'mariadb':
    case 'mysql':
      return Utils.addTicks(Utils.removeTicks(identifier, '`'), '`');
    case 'snowflake':
    case 'postgres':
      const rawIdentifier = Utils.removeTicks(identifier, '"');

      if (
        options.force !== true &&
        options.quoteIdentifiers === false &&
        !identifier.includes('.') &&
        !identifier.includes('->') &&
        (dialect === 'postgres' && !postgresReservedWords.includes(rawIdentifier.toLowerCase()) || dialect === 'snowflake' && !snowflakeReservedWords.includes(rawIdentifier.toLowerCase()))
      ) {
        // In Postgres and Snowflake, if tables or attributes are created double-quoted,
        // they are also case sensitive. If they contain any uppercase
        // characters, they must always be double-quoted. This makes it
        // impossible to write queries in portable SQL if tables are created in
        // this way. Hence, we strip quotes if we don't want case sensitivity.
        return rawIdentifier;
      }
      return Utils.addTicks(rawIdentifier, '"');
    case 'mssql':
      return `[${identifier.replace(/[[\]']+/g, '')}]`;

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
