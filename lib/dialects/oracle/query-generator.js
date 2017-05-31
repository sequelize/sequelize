'use strict';

/* jshint -W110 */
const Utils = require('../../utils');
const DataTypes = require('../../data-types');
const AbstractQueryGenerator = require('../abstract/query-generator');
const _ = require('lodash');
const crc32 = require('js-crc').crc32;
const uuid = require('uuid');

//List of Oracle reserved words https://docs.oracle.com/cd/B19306_01/em.102/b40103/app_oracle_reserved_words.htm
const oracleReservedWords = ['ACCESS', 'ACCOUNT', 'ACTIVATE', 'ADD', 'ADMIN', 'ADVISE', 'AFTER', 'ALL', 'ALL_ROWS', 'ALLOCATE', 'ALTER', 'ANALYZE', 'AND', 'ANY', 'ARCHIVE', 'ARCHIVELOG', 'ARRAY', 'AS', 'ASC', 'AT', 'AUDIT', 'AUTHENTICATED', 'AUTHORIZATION', 'AUTOEXTEND', 'AUTOMATIC', 'BACKUP', 'BECOME', 'BEFORE', 'BEGIN', 'BETWEEN', 'BFILE', 'BITMAP', 'BLOB', 'BLOCK', 'BODY', 'BY', 'CACHE', 'CACHE_INSTANCES', 'CANCEL', 'CASCADE', 'CAST', 'CFILE', 'CHAINED', 'CHANGE', 'CHAR', 'CHAR_CS', 'CHARACTER', 'CHECK', 'CHECKPOINT', 'CHOOSE', 'CHUNK', 'CLEAR', 'CLOB', 'CLONE', 'CLOSE', 'CLOSE_CACHED_OPEN_CURSORS', 'CLUSTER', 'COALESCE', 'COLUMN', 'COLUMNS', 'COMMENT', 'COMMIT', 'COMMITTED', 'COMPATIBILITY', 'COMPILE', 'COMPLETE', 'COMPOSITE_LIMIT', 'COMPRESS', 'COMPUTE', 'CONNECT', 'CONNECT_TIME', 'CONSTRAINT', 'CONSTRAINTS', 'CONTENTS', 'CONTINUE', 'CONTROLFILE', 'CONVERT', 'COST', 'CPU_PER_CALL', 'CPU_PER_SESSION', 'CREATE', 'CURRENT', 'CURRENT_SCHEMA', 'CURREN_USER', 'CURSOR', 'CYCLE', 'DANGLING', 'DATABASE', 'DATAFILE', 'DATAFILES', 'DATAOBJNO', 'DATE', 'DBA', 'DBHIGH', 'DBLOW', 'DBMAC', 'DEALLOCATE', 'DEBUG', 'DEC', 'DECIMAL', 'DECLARE', 'DEFAULT', 'DEFERRABLE', 'DEFERRED', 'DEGREE', 'DELETE', 'DEREF', 'DESC', 'DIRECTORY', 'DISABLE', 'DISCONNECT', 'DISMOUNT', 'DISTINCT', 'DISTRIBUTED', 'DML', 'DOUBLE', 'DROP', 'DUMP', 'EACH', 'ELSE', 'ENABLE', 'END', 'ENFORCE', 'ENTRY', 'ESCAPE', 'EXCEPT', 'EXCEPTIONS', 'EXCHANGE', 'EXCLUDING', 'EXCLUSIVE', 'EXECUTE', 'EXISTS', 'EXPIRE', 'EXPLAIN', 'EXTENT', 'EXTENTS', 'EXTERNALLY', 'FAILED_LOGIN_ATTEMPTS', 'FALSE', 'FAST', 'FILE', 'FIRST_ROWS', 'FLAGGER', 'FLOAT', 'FLOB', 'FLUSH', 'FOR', 'FORCE', 'FOREIGN', 'FREELIST', 'FREELISTS', 'FROM', 'FULL', 'FUNCTION', 'GLOBAL', 'GLOBALLY', 'GLOBAL_NAME', 'GRANT', 'GROUP', 'GROUPS', 'HASH', 'HASHKEYS', 'HAVING', 'HEADER', 'HEAP', 'IDENTIFIED', 'IDGENERATORS', 'IDLE_TIME', 'IF', 'IMMEDIATE', 'IN', 'INCLUDING', 'INCREMENT', 'INDEX', 'INDEXED', 'INDEXES', 'INDICATOR', 'IND_PARTITION', 'INITIAL', 'INITIALLY', 'INITRANS', 'INSERT', 'INSTANCE', 'INSTANCES', 'INSTEAD', 'INT', 'INTEGER', 'INTERMEDIATE', 'INTERSECT', 'INTO', 'IS', 'ISOLATION', 'ISOLATION_LEVEL', 'KEEP', 'KEY', 'KILL', 'LABEL', 'LAYER', 'LESS', 'LEVEL', 'LIBRARY', 'LIKE', 'LIMIT', 'LINK', 'LIST', 'LOB', 'LOCAL', 'LOCK', 'LOCKED', 'LOG', 'LOGFILE', 'LOGGING', 'LOGICAL_READS_PER_CALL', 'LOGICAL_READS_PER_SESSION', 'LONG', 'MANAGE', 'MASTER', 'MAX', 'MAXARCHLOGS', 'MAXDATAFILES', 'MAXEXTENTS', 'MAXINSTANCES', 'MAXLOGFILES', 'MAXLOGHISTORY', 'MAXLOGMEMBERS', 'MAXSIZE', 'MAXTRANS', 'MAXVALUE', 'MIN', 'MEMBER', 'MINIMUM', 'MINEXTENTS', 'MINUS', 'MINVALUE', 'MLSLABEL', 'MLS_LABEL_FORMAT', 'MODE', 'MODIFY', 'MOUNT', 'MOVE', 'MTS_DISPATCHERS', 'MULTISET', 'NATIONAL', 'NCHAR', 'NCHAR_CS', 'NCLOB', 'NEEDED', 'NESTED', 'NETWORK', 'NEW', 'NEXT', 'NOARCHIVELOG', 'NOAUDIT', 'NOCACHE', 'NOCOMPRESS', 'NOCYCLE', 'NOFORCE', 'NOLOGGING', 'NOMAXVALUE', 'NOMINVALUE', 'NONE', 'NOORDER', 'NOOVERRIDE', 'NOPARALLEL', 'NOPARALLEL', 'NOREVERSE', 'NORMAL', 'NOSORT', 'NOT', 'NOTHING', 'NOWAIT', 'NULL', 'NUMBER', 'NUMERIC', 'NVARCHAR2', 'OBJECT', 'OBJNO', 'OBJNO_REUSE', 'OF', 'OFF', 'OFFLINE', 'OID', 'OIDINDEX', 'OLD', 'ON', 'ONLINE', 'ONLY', 'OPCODE', 'OPEN', 'OPTIMAL', 'OPTIMIZER_GOAL', 'OPTION', 'OR', 'ORDER', 'ORGANIZATION', 'OSLABEL', 'OVERFLOW', 'OWN', 'PACKAGE', 'PARALLEL', 'PARTITION', 'PASSWORD', 'PASSWORD_GRACE_TIME', 'PASSWORD_LIFE_TIME', 'PASSWORD_LOCK_TIME', 'PASSWORD_REUSE_MAX', 'PASSWORD_REUSE_TIME', 'PASSWORD_VERIFY_FUNCTION', 'PCTFREE', 'PCTINCREASE', 'PCTTHRESHOLD', 'PCTUSED', 'PCTVERSION', 'PERCENT', 'PERMANENT', 'PLAN', 'PLSQL_DEBUG', 'POST_TRANSACTION', 'PRECISION', 'PRESERVE', 'PRIMARY', 'PRIOR', 'PRIVATE', 'PRIVATE_SGA', 'PRIVILEGE', 'PRIVILEGES', 'PROCEDURE', 'PROFILE', 'PUBLIC', 'PURGE', 'QUEUE', 'QUOTA', 'RANGE', 'RAW', 'RBA', 'READ', 'READUP', 'REAL', 'REBUILD', 'RECOVER', 'RECOVERABLE', 'RECOVERY', 'REF', 'REFERENCES', 'REFERENCING', 'REFRESH', 'RENAME', 'REPLACE', 'RESET', 'RESETLOGS', 'RESIZE', 'RESOURCE', 'RESTRICTED', 'RETURN', 'RETURNING', 'REUSE', 'REVERSE', 'REVOKE', 'ROLE', 'ROLES', 'ROLLBACK', 'ROW', 'ROWID', 'ROWNUM', 'ROWS', 'RULE', 'SAMPLE', 'SAVEPOINT', 'SB4', 'SCAN_INSTANCES', 'SCHEMA', 'SCN', 'SCOPE', 'SD_ALL', 'SD_INHIBIT', 'SD_SHOW', 'SEGMENT', 'SEG_BLOCK', 'SEG_FILE', 'SELECT', 'SEQUENCE', 'SERIALIZABLE', 'SESSION', 'SESSION_CACHED_CURSORS', 'SESSIONS_PER_USER', 'SET', 'SHARE', 'SHARED', 'SHARED_POOL', 'SHRINK', 'SIZE', 'SKIP', 'SKIP_UNUSABLE_INDEXES', 'SMALLINT', 'SNAPSHOT', 'SOME', 'SORT', 'SPECIFICATION', 'SPLIT', 'SQL_TRACE', 'STANDBY', 'START', 'STATEMENT_ID', 'STATISTICS', 'STOP', 'STORAGE', 'STORE', 'STRUCTURE', 'SUCCESSFUL', 'SWITCH', 'SYS_OP_ENFORCE_NOT_NULL$', 'SYS_OP_NTCIMG$', 'SYNONYM', 'SYSDATE', 'SYSDBA', 'SYSOPER', 'SYSTEM', 'TABLE', 'TABLES', 'TABLESPACE', 'TABLESPACE_NO', 'TABNO', 'TEMPORARY', 'THAN', 'THE', 'THEN', 'THREAD', 'TIMESTAMP', 'TIME', 'TO', 'TOPLEVEL', 'TRACE', 'TRACING', 'TRANSACTION', 'TRANSITIONAL', 'TRIGGER', 'TRIGGERS', 'TRUE', 'TRUNCATE', 'TX', 'TYPE', 'UB2', 'UBA', 'UID', 'UNARCHIVED', 'UNDO', 'UNION', 'UNIQUE', 'UNLIMITED', 'UNLOCK', 'UNRECOVERABLE', 'UNTIL', 'UNUSABLE', 'UNUSED', 'UPDATABLE', 'UPDATE', 'USAGE', 'USE', 'USER', 'USING', 'VALIDATE', 'VALIDATION', 'VALUE', 'VALUES', 'VARCHAR', 'VARCHAR2', 'VARYING', 'VIEW', 'WHEN', 'WHENEVER', 'WHERE', 'WITH', 'WITHOUT', 'WORK', 'WRITE', 'WRITEDOWN', 'WRITEUP', 'XID', 'YEAR', 'ZONE'];

/* istanbul ignore next */
const throwMethodUndefined = function (methodName) {
  throw new Error('The method "' + methodName + '" is not defined! Please add it to your sql dialect.');
};

const QueryGenerator = {
  options: {},
  dialect: 'oracle',

  createSchema(schema) {
    schema = this.quoteIdentifier(schema);
    return [
      'DECLARE',
      '  V_COUNT INTEGER;',
      '  V_CURSOR_NAME INTEGER;',
      '  V_RET INTEGER;',
      'BEGIN',
      '  SELECT COUNT(1) INTO V_COUNT FROM ALL_USERS WHERE USERNAME = ', wrapSingleQuote(schema), ';',
      '  IF V_COUNT = 0 THEN',
      '    EXECUTE IMMEDIATE ', wrapSingleQuote('CREATE USER ' + schema + ' IDENTIFIED BY 12345 DEFAULT TABLESPACE USERS'), ';',
      '    EXECUTE IMMEDIATE ', wrapSingleQuote('GRANT "CONNECT" TO ' + schema), ';',
      '    EXECUTE IMMEDIATE ', wrapSingleQuote('GRANT create table TO ' + schema), ';',
      '    EXECUTE IMMEDIATE ', wrapSingleQuote('GRANT create view TO ' + schema), ';',
      '    EXECUTE IMMEDIATE ', wrapSingleQuote('GRANT create any trigger TO ' + schema), ';',
      '    EXECUTE IMMEDIATE ', wrapSingleQuote('GRANT create any procedure TO ' + schema), ';',
      '    EXECUTE IMMEDIATE ', wrapSingleQuote('GRANT create sequence TO ' + schema), ';',
      '    EXECUTE IMMEDIATE ', wrapSingleQuote('GRANT create synonym TO ' + schema), ';',
      // '    EXECUTE IMMEDIATE ', wrapSingleQuote('GRANT select on dba_segments TO ' + schema), ';',
      // '    EXECUTE IMMEDIATE ', wrapSingleQuote('GRANT select on dba_constraints TO ' + schema), ';',
      // '    EXECUTE IMMEDIATE ', wrapSingleQuote('GRANT select on dba_tables TO ' + schema), ';',
      '    EXECUTE IMMEDIATE ', wrapSingleQuote('ALTER USER ' + schema + ' QUOTA UNLIMITED ON USERS'), ';',
      '  END IF;',
      'END;'
    ].join(' ');
  },

  showSchemasQuery() {
    return 'SELECT USERNAME AS "schema_name" FROM ALL_USERS WHERE COMMON = (\'NO\') AND USERNAME != user';
  },

  dropSchema(tableName) {
    return 'DROP USER ' + this.quoteTable(tableName) + ' CASCADE';
  },

  versionQuery() {
    return 'SELECT VERSION FROM PRODUCT_COMPONENT_VERSION WHERE PRODUCT LIKE \'Oracle%\'';
  },


  createTableQuery(tableName, attributes, options) {
    let query = 'CREATE TABLE <%= table %> (<%= attributes %>)';
    const completeQuery = "BEGIN EXECUTE IMMEDIATE '<%= createTableQuery %>'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;", 
      self = this;
    const primaryKeys = [], foreignKeys = {}, attrStr = [], checkStr = [];

    const values = {
      table: this.quoteTable(tableName)
    };

    const regex = /REFERENCES ([a-zA-Z_.0-9]*) \((.*)\)/g; //Global regex
    const chkRegex = /CHECK \(([a-zA-Z_.0-9]*) (.*)\)/g; //Check regex

    //Starting by dealing with all attributes
    for (let attr in attributes) {
      if (attributes.hasOwnProperty(attr)) {
        const dataType = attributes[attr];
        let match;

        attr = this.quoteIdentifier(attr);

        // ORACLE doesn't support inline REFERENCES declarations: move to the end
        if (Utils._.includes(dataType, 'PRIMARY KEY')) {
          //Primary key
          primaryKeys.push(attr);
          if (Utils._.includes(dataType, 'REFERENCES')) {
            match = dataType.match(/^(.+) (REFERENCES.*)$/);
            attrStr.push(attr + ' ' + match[1].replace(/PRIMARY KEY/, ''));

            foreignKeys[attr] = match[2].replace(regex, (match, table, column) => {
              //We don't want the table name to be quoted if we pass the schema name
              let tableName = '';
              if (Utils._.isPlainObject(table)) {
                if (table.schema) {
                  tableName = this.quoteTable(table.schema) + '.';
                }
                tableName += this.quoteTable(table.tableName);
              } else {
                tableName = Utils._.includes(oracleReservedWords, table.toUpperCase()) ? '"' + table + '"' : table;
              }

              return `REFERENCES ${tableName} (${this.quoteIdentifier(column)})`;
            });
          } else {
            attrStr.push(attr + ' ' + dataType.replace(/PRIMARY KEY/, '').trim());
          }

        } else if (Utils._.includes(dataType, 'REFERENCES')) {

          //Foreign key
          match = dataType.match(/^(.+) (REFERENCES.*)$/);
          attrStr.push(attr + ' ' + match[1]);

          foreignKeys[attr] = match[2].replace(regex, (match, table, column) => {
            //We don't want the table name to be quoted if we pass the schema name
            let tableName = '';
            if (Utils._.isPlainObject(table)) {
              if (table.schema) {
                tableName = this.quoteTable(table.schema) + '.';
              }
              tableName += this.quoteTable(table.tableName);
            } else {
              tableName = Utils._.includes(oracleReservedWords, table.toUpperCase()) ? '"' + table + '"' : table;
            }
            return `REFERENCES ${tableName} (${this.quoteIdentifier(column)})`;
          });
        } else if (Utils._.includes(dataType, 'CHECK')) {
          //Check constraints go to the end
          match = dataType.match(/^(.+) (CHECK.*)$/);
          attrStr.push(attr + ' ' + match[1]);
          match[2] = match[2].replace('ATTRIBUTENAME', attr);
          const checkCond = match[2].replace(chkRegex, (match, column, condition) => {
            return `CHECK (${this.quoteIdentifier(column)} ${condition})`;
          });

          checkStr.push(checkCond);
        } else {
          attrStr.push(attr + ' ' + dataType);
        }
      }
    }

    values['attributes'] = attrStr.join(', ');

    const pkString = primaryKeys.map((pk => {
      return this.quoteIdentifier(pk);
    }).bind(this)).join(', ');

    if (pkString.length > 0) {

      let primaryKeyName = `PK${values.table}${pkString}`.replace(/[.,"\s]/g, ''); //We replace the space if there are multiple columns

      //Oracle doesn't support names with more that 32 characters, so we replace it by PK CRC32
      if (primaryKeyName.length > 30) {
        primaryKeyName = `PK${values.table}${crc32(pkString)}`.replace(/[.,"\s]/g, '');
        if (primaryKeyName.length > 30) {
          const crcName = crc32(`${values.table}_${pkString}`);
          primaryKeyName = `PK${crcName}`.replace(/[.,"\s]/g, '');
        }
      }

      values.attributes += ',CONSTRAINT ' + primaryKeyName + ' PRIMARY KEY (' + pkString + ')';
    }

    //Dealing with FKs
    for (const fkey in foreignKeys) {
      if (foreignKeys.hasOwnProperty(fkey)) {

        //Oracle default response for FK, doesn't support if defined
        if (foreignKeys[fkey].indexOf('ON DELETE NO ACTION') > - 1) {
          foreignKeys[fkey] = foreignKeys[fkey].replace('ON DELETE NO ACTION', '');
        }

        let fkName = `FK${values.table}${fkey}`.replace(/[."]/g, '');
        //Oracle doesn't support names with more that 32 characters, so we replace it by FK CRC(columns)
        if (fkName.length > 30) {
          fkName = `FK${values.table}${crc32(fkey)}`.replace(/[."]/g, '');
          //If the name is still too long (table name very long), we generate only FK CRC(table_columns)
          if (fkName.length > 30) {
            const crcName = crc32(`${values.table}_${fkey}`);
            fkName = `FK${crcName}`.replace(/[."]/g, '');
          }
        }

        values.attributes += ',CONSTRAINT ' + fkName + ' FOREIGN KEY (' + this.quoteIdentifier(fkey) + ') ' + foreignKeys[fkey];
      }
    }

    if (checkStr.length > 0) {
      values.attributes += ', ' + checkStr.join(', ');
    }

    //Specific case for unique indexes with Oracle, we have to set the constraint on the column, if not, no FK will be possible (ORA-02270: no matching unique or primary key for this column-list)
    if (options && options.indexes && options.indexes.length > 0) {

      const idxToDelete = [];
      options.indexes.forEach((index, idx) => {
        if (index.unique === true) {
          //If unique index, transform to unique constraint on column
          const fields = index.fields.map(field => {
            if (typeof field === 'string') {
              return field;
            } else {
              return field.attribute;
            }
          });

          //Now we have to be sure that the constraint isn't already declared in uniqueKeys
          let canContinue = true;
          if (options.uniqueKeys) {
            const keys = Object.keys(options.uniqueKeys);

            for (let fieldIdx = 0; fieldIdx < keys.length; fieldIdx++) {
              const currUnique = options.uniqueKeys[keys[fieldIdx]];

              if (currUnique.fields.length === fields.length) {
                //lengths are the same, possible same constraint
                for (let i = 0; i < currUnique.fields.length; i++) {
                  const field = currUnique.fields[i];

                  if (Utils._.includes(fields, field)) {
                    canContinue = false;
                  } else {
                    //We have at least one different column, even if we found the same columns previously, we let the constraint be created
                    canContinue = true;
                    break;
                  }
                }
              }
            }

            if (canContinue) {
              let indexName = 'name' in index ? index.name : '';

              if (indexName === '' || indexName.length > 30) {
                indexName = this._generateUniqueConstraintName(values.table, fields);
              }
              const constraintToAdd = {
                name: indexName,
                fields
              };
              if (!('uniqueKeys' in options)) {
                options.uniqueKeys = {};
              }

              options.uniqueKeys[indexName] = constraintToAdd;
              idxToDelete.push(idx);
            } else {
              //The constraint already exists, we remove it from the list
              idxToDelete.push(idx);
            }
          }
        }
      });
      idxToDelete.forEach(idx => {
        options.indexes.splice(idx, 1);
      });
    }

    if (options && !!options.uniqueKeys) {
      Utils._.each(options.uniqueKeys, (columns, indexName) => {
        let canBeUniq = false;

        //Check if we can create the unique key
        primaryKeys.forEach(primaryKey => {
          //We can create an unique constraint if it's not on the primary key AND if it doesn't have unique in its definition

          if (!Utils._.includes(columns.fields, primaryKey)) {
            canBeUniq = true;
          }
        });

        columns.fields.forEach(field => {
          let currField = '';
          if (!Utils._.isString(field)) {
            currField = field.attribute.replace(/[.,"\s]/g, '');
          } else {
            currField = field.replace(/[.,"\s]/g, '');
          }
          if (currField in attributes) {
            if (attributes[currField].toUpperCase().indexOf('UNIQUE') > -1) {
              //We generate the attribute without UNIQUE
              const attrToReplace = attributes[currField].replace('UNIQUE', '');
              //We replace in the final string
              values.attributes = values.attributes.replace(attributes[currField], attrToReplace);
            }
          }
        });

        //Oracle cannot have an unique AND a primary key on the same fields, prior to the primary key 
        if (canBeUniq) {
          if (!Utils._.isString(indexName)) {
            indexName = this._generateUniqueConstraintName(values.table, columns.fields);
          }

          //Oracle doesn't support names with more that 32 characters, so we replace it by PK timestamp
          if (indexName.length > 30) {
            indexName = this._generateUniqueConstraintName(values.table, columns.fields);
          }

          const indexUpperName = indexName.toUpperCase();

          if (Utils._.includes(oracleReservedWords, indexUpperName) || indexUpperName.charAt(0) === '_') {
            indexName = '"' + indexName + '"';
          }

          const index = options.uniqueKeys[columns.name];
          delete options.uniqueKeys[columns.name];
          indexName = indexName.replace(/[.,\s]/g, '');
          columns.name = indexName;
          options.uniqueKeys[indexName] = index;
          values.attributes += ', CONSTRAINT ' + indexName + ' UNIQUE (' + Utils._.map(columns.fields, self.quoteIdentifier).join(', ') + ')';
        }
      });
    }

    query = Utils._.template(query)(values).trim();
    //we replace single quotes by two quotes in order for the execute statement to work
    query = query.replace(/'/g, "''");
    values.createTableQuery = query;

    return Utils._.template(completeQuery)(values).trim();
  },

  /**
   * Generates a name for an unique constraint with te pattern : uniqTABLENAMECOLUMNNAMES
   * If this indexName is too long for Oracle, it's hashed to have an acceptable length
   */
  _generateUniqueConstraintName(table, columns) {

    let indexName = `uniq${table}${columns.join('')}`.replace(/[.,"\s]/g, '').toLowerCase();

    //Oracle doesn't support names with more that 32 characters, so we replace it by PK timestamp
    if (indexName.length > 30) {
      indexName = `uniq${table}${crc32(columns.join(''))}`.replace(/[.,"\s]/g, '').toLowerCase();

      if (indexName.length > 30) {
        const crcName = crc32(`${table}_${columns.join('')}`);
        indexName = `uniq${crcName}`.replace(/[.,"\s]/g, '').toLowerCase();
      }
    }

    return indexName;
  },

  describeTableQuery(tableName, schema) {
    //name, type, datalength (except number / nvarchar), datalength varchar, datalength number, nullable, default value, primary ?
    const sql = ['SELECT atc.COLUMN_NAME, atc.DATA_TYPE, atc.DATA_LENGTH, atc.CHAR_LENGTH, atc.DEFAULT_LENGTH, atc.NULLABLE, ',
      'CASE WHEN ucc.CONSTRAINT_NAME  LIKE\'%PK%\' THEN \'PRIMARY\' ELSE \'\' END AS "PRIMARY" ',
      'FROM all_tab_columns atc ',
      'LEFT OUTER JOIN all_cons_columns ucc ON(atc.table_name = ucc.table_name AND atc.COLUMN_NAME = ucc.COLUMN_NAME ) ',
      schema ? 'WHERE (atc.OWNER=UPPER(\'<%= schema %>\') OR atc.OWNER=\'<%= schema %>\') ' : 'WHERE atc.OWNER=(SELECT USER FROM DUAL) ',
      'AND (atc.TABLE_NAME=UPPER(\'<%= tableName %>\') OR atc.TABLE_NAME=\'<%= tableName %>\')',
      'ORDER BY "PRIMARY", atc.COLUMN_NAME'].join('');

    const currTableName = Utils._.isPlainObject(tableName) ? tableName.tableName : tableName;

    const values = {
      tableName: currTableName,
      schema
    };

    return Utils._.template(sql)(values).trim();
  },

  renameTableQuery(before, after) {
    const query = 'ALTER TABLE <%= before %> RENAME TO <%= after %>';
    return Utils._.template(query)({
      before,
      after
    });
  },



  showConstraintsQuery(tableName) {
    return `SELECT CONSTRAINT_NAME constraint_name FROM user_cons_columns WHERE table_name = '${tableName.toUpperCase()}'`;
  },

  showTablesQuery() {

    //Carefull, heavy load
    //Thanks http://sqlblog.com/blogs/jamie_thomson/archive/2009/09/08/deriving-a-list-of-tables-in-dependency-order.aspx

    const subQuery = 'SELECT USERNAME AS "schema_name" FROM ALL_USERS WHERE COMMON = (\'NO\')';

    const sql = ['SELECT DISTINCT table_name, lvl, owner as table_schema ',
      'FROM ( ',
      'SELECT a.*, rank() over (partition by table_name order by lvl desc) rnk ',
      'FROM ( ',
      'SELECT  table_name, level lvl, owner ',
      'FROM  (',
      'SELECT DISTINCT a.table_name AS table_name, b.table_name AS parent_table_name, a.owner ',
      'FROM dba_constraints a LEFT OUTER JOIN dba_constraints b ON a.r_constraint_name = b.constraint_name AND a.owner = b.owner ',
      'WHERE a.owner IN (<%= subQuery %>) ',
      'AND a.table_name NOT LIKE \'%BIN%\'',
      ') START WITH parent_table_name IS NULL CONNECT BY NOCYCLE parent_table_name = PRIOR table_name ',
      ') a  ',
      ') b ',
      'WHERE rnk = 1 ',
      'UNION ',
      //From here we search for all tables without any dependency
      'SELECT table_name, 0 AS lvl, OWNER as TABLE_SCHEMA FROM dba_tables ',
      'WHERE OWNER IN (<%= subQuery %>) AND table_name NOT IN (',
      'SELECT DISTINCT(table_name) ',
      'FROM all_cons_columns',
      ') AND TABLESPACE_NAME IS NOT NULL ORDER BY lvl desc, table_name'].join('');

    const values = {
      subQuery
    };

    return Utils._.template(sql)(values);
  },

  dropTableQuery(tableName, isFull = true) {
    let table = '';
    table = this.quoteTable(tableName);
    const query = [];

    if (isFull) {
      query.push('BEGIN ');
    }

    query.push('EXECUTE IMMEDIATE \'DROP TABLE <%= table %> CASCADE CONSTRAINTS\';');

    if (isFull) {
      query.push(' EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN');
      query.push(' RAISE; END IF;');
      query.push('END;');
    }


    const values = {
      table
    };

    return Utils._.template(query.join(''))(values).trim();
  },

  addConstraintQuery(tableName, options) {
    options = options || {};

    //Oracle doesn't support On update
    delete options.onUpdate;
    const constraintSnippet = this.getConstraintSnippet(tableName, options);

    if (typeof tableName === 'string') {
      tableName = this.quoteIdentifiers(tableName);
    } else {
      tableName = this.quoteTable(tableName);
    }

    return `ALTER TABLE ${tableName} ADD ${constraintSnippet}`;
  },

  addColumnQuery(table, key, dataType) {
    // FIXME: attributeToSQL SHOULD be using attributes in addColumnQuery
    //        but instead we need to pass the key along as the field here
    dataType.field = key;

    const query = 'ALTER TABLE <%= table %> ADD (<%= attribute %>)'
      , attribute = Utils._.template('<%= key %> <%= definition %>')({
        key,
        definition: this.attributeToSQL(dataType, {
          context: 'addColumn'
        }).replace('ATTRIBUTENAME', key).replace(/'/g, "'")
      });

    return Utils._.template(query)({
      table: this.quoteTable(table),
      attribute
    });
  },

  removeColumnQuery(tableName, attributeName) {
    const query = 'ALTER TABLE <%= tableName %> DROP COLUMN <%= attributeName %>';

    return Utils._.template(query)({
      tableName: this.quoteTable(tableName),
      attributeName
    });
  },

  changeColumnQuery(tableName, attributes) {
    const modifyQuery = 'ALTER TABLE <%= tableName %> MODIFY (<%= query %>)';
    const alterQuery = 'ALTER TABLE <%= tableName %> <%= query %>';
    let query = '';
    const attrString = [], constraintString = [];

    for (const attributeName in attributes) {
      let definition = attributes[attributeName];
      if (definition.match(/REFERENCES/)) {
        constraintString.push(Utils._.template('<%= fkName %> FOREIGN KEY (<%= attrName %>) <%= definition %>')({
          fkName: attributeName + '_foreign_idx',
          attrName: attributeName,
          definition: definition.replace(/.+?(?=REFERENCES)/, '')
        }));
      } else {
        if (definition.indexOf('CHECK') > -1) {
          definition = definition.replace(/'/g, "''");
        }
        attrString.push(Utils._.template('<%= attrName %> <%= definition %>')({
          attrName: attributeName,
          definition
        }));
      }
    }

    let fullQuery = 'BEGIN '
      + 'EXECUTE IMMEDIATE \'<%= fullQuery %>\';'
      + ' EXCEPTION'
      + ' WHEN OTHERS THEN'
      + ' IF SQLCODE = -1442 OR SQLCODE = -1451 THEN'
      + ' EXECUTE IMMEDIATE \'<%= secondQuery %>\';' //We execute the statement without the NULL / NOT NULL clause if the first statement failed due to this
      + ' ELSE'
      + ' RAISE;'
      + ' END IF;'
      + ' END;';

    let finalQuery = '';
    if (attrString.length) {
      finalQuery += attrString.join(', ');
      finalQuery += constraintString.length ? ' ' : '';
    }
    if (constraintString.length) {
      finalQuery += 'ADD CONSTRAINT ' + constraintString.join(', ');
      //Here, we don't use modify
      query = alterQuery;
    } else {
      query = modifyQuery;
    }

    query = Utils._.template(query)({
      tableName: this.quoteTable(tableName),
      query: finalQuery
    });

    //Oracle doesn't support if we try to define a NULL / NOT NULL column if it is already in this case 
    //see https://docs.oracle.com/cd/B28359_01/server.111/b28278/e900.htm#ORA-01451
    const secondQuery = query.replace('NOT NULL', '').replace('NULL', '');

    return fullQuery = Utils._.template(fullQuery)({
      fullQuery: query,
      secondQuery
    });
  },

  renameColumnQuery(tableName, attrBefore, attributes) {
    const query = 'ALTER TABLE <%= tableName %> RENAME COLUMN <%= before %> TO <%= after %>'
      , newName = Object.keys(attributes)[0];

    return Utils._.template(query)({
      tableName: this.quoteTable(tableName),
      before: attrBefore,
      after: newName
    });
  },

  /**
   * NOT COMPLETE
   * Override of upsertQuery, Oracle specific
   * Format is MERGE INTO tableName USING DUAL ON (where condition) WHEN MATCHED THEN UpdateQuery(no table name) WHEN NOT MATCHED THEN InsertQuery(no INTO table name)
   */
  upsertQuery(tableName, insertValues, updateValues, where, rawAttributes, options) {
    if (tableName ||insertValues ||updateValues ||where ||rawAttributes ||options) {
      //Doing nothing, just checking the vars for eslint
    }
    throw new Error('Not implemented');

    //All conditions in ON cannot be in the update statement (they are automatically setted by ON)
    /*if (where && Utils._.isPlainObject(where)) {
      let whereKeys = Object.keys(where);
      whereKeys.forEach(whereKey => {
        let whereObject = where[whereKey];
        let toDeleteKeys = [];
        // let toDeleteKeys = Object.keys(whereObject[0]);
        whereObject.forEach(whereClause => {
          toDeleteKeys.push(Object.keys(whereClause)[0])
        });
        toDeleteKeys.forEach(toDeleteKey => {
          if (toDeleteKey in updateValues) {
            delete updateValues[toDeleteKey];
          }
        });
      });
    }

    let whereQuery = this.whereQuery(where, options);
    let insertQuery = this.insertQuery(tableName, insertValues, rawAttributes, options);
    let updateQuery = this.updateQuery(tableName, updateValues, null, options, rawAttributes);

    //For merge, update doesn't need the table name
    updateQuery = updateQuery.replace(this.quoteTable(tableName), '');

    //For merge, insert doesn't need INTO table name
    insertQuery = insertQuery.replace(`INTO ${this.quoteTable(tableName)}`, '');

    //We had a full where query, we just don't want the WHERE
    whereQuery = whereQuery.replace('WHERE ', '');

    let query = `MERGE INTO ${this.quoteTable(tableName)} USING dual ON ${whereQuery} WHEN MATCHED THEN ${updateQuery} WHEN NOT MATCHED THEN ${insertQuery}`;

    return query;*/
  },

  /*
  * Override of insertQuery, Oracle specific
  */
  insertQuery(table, valueHash, modelAttributes, options) {
    options = options || {};
    _.defaults(options, this.options);

    const valueQuery = 'INSERT INTO <%= table %> (<%= attributes %>) VALUES (<%= values %>)'
      , emptyQuery = 'INSERT INTO <%= table %> VALUES (DEFAULT)'
      , fields = []
      , values = []
      , primaryKeys = []
      , modelAttributeMap = {}
      , realTableName = this.quoteTable(table)
      , primaryKeyReturn = [];
    let key
      , query
      , value;



    //We have to specify a variable that will be used as return value for the id
    const returningQuery = '<%=valueQuery %> RETURNING <%=primaryKey %> INTO <%=primaryKeyReturn %>';

    if (modelAttributes) {

      //We search for the primaryKey
      const keys = Object.keys(modelAttributes);
      let idx = 0;

      while (idx < keys.length) {
        const AttributeKey = keys[idx];
        const modelAttribute = modelAttributes[AttributeKey];
        if (modelAttribute.primaryKey) {
          primaryKeys.push(modelAttribute);

        }
        idx++;
      }

      Utils._.each(modelAttributes, (attribute, key) => {
        modelAttributeMap[key] = attribute;
        if (attribute.field) {
          modelAttributeMap[attribute.field] = attribute;
        }
      });
    }

    valueHash = Utils.removeNullValuesFromHash(valueHash, this.options.omitNull);
    for (key in valueHash) {
      if (valueHash.hasOwnProperty(key)) {
        value = valueHash[key];
        fields.push(this.quoteIdentifier(key));

        // SERIALS' can't be NULL in postgresql, use DEFAULT where supported
        if (modelAttributeMap && modelAttributeMap[key] && modelAttributeMap[key].autoIncrement === true && !value) {
          values.push('DEFAULT');
          
        } else {
          if (modelAttributeMap && modelAttributeMap[key] && !modelAttributeMap[key].allowNull && value.length === 0) {
            //Oracle refuses an insert in not null column with empty value (considered as null)
            value = ' ';
          }
          values.push(this.escape(value, (modelAttributeMap && modelAttributeMap[key]) || undefined, { context: 'INSERT' }));
        }
      }
    }

    let primaryKey = '';

    primaryKeys.forEach(element => {
      if (element.field.toLowerCase() === 'uid') {
        primaryKey += primaryKey.length > 0 ? ',"uid"' : '"uid"';

        const pkReturn = `$:pkReturnVal;${element.type.toSql()}$`;
        primaryKeyReturn.push(pkReturn);
      } else {
        primaryKey += primaryKey.length > 0 ? ',' + this.quoteIdentifier(element.field) : this.quoteIdentifier(element.field);
        const pkReturn = `$:${element.field};${element.type.toSql()}$`;
        primaryKeyReturn.push(pkReturn);
      }
    });

    //If we want a return AND we haven't specified a primary key in the column list
    if (options.returning && primaryKey === '') {
      const tableKeys = Object.keys(this.sequelize.models);
      const currTableName = Utils._.isPlainObject(table) ? table.tableName : table;

      const currentModelKey = tableKeys.find(modelKey => {
        return this.sequelize.models[modelKey].tableName === currTableName;
      });

      const currentModel = this.sequelize.models[currentModelKey];
      if ((!currentModel || !currentModel.hasPrimaryKeys) && modelAttributes) {
        //We don't have a primaryKey, so we will return the first column inserted
        let field = modelAttributes[Object.keys(modelAttributes)[0]].field;

        if (Utils._.includes(oracleReservedWords, field.toUpperCase())) {
          //The column name we want to return is a reserved word, so we change it for the request to be OK
          field = 'pkReturnVal';
        }
        const pkReturn = `$:${field};string$`;
        primaryKey = this.quoteIdentifier(modelAttributes[Object.keys(modelAttributes)[0]].field);
        primaryKeyReturn.push(pkReturn);
      }
    }

    const replacements = {
      // ignore: options.ignore ? this._dialect.supports.IGNORE : '',
      primaryKey,
      primaryKeyReturn: primaryKeyReturn.join(','),
      table: realTableName,
      attributes: fields.join(','),
      values: values.join(',')
    };

    if (options.returning && replacements.attributes && replacements.attributes.length > 0) {
      query = returningQuery;
      replacements.valueQuery = Utils._.template(valueQuery)(replacements);
    } else {
      query = (replacements.attributes.length ? valueQuery : emptyQuery);
    }

    return Utils._.template(query)(replacements);
  },


  /**
   * Oracle way to insert multiple rows inside a single statement
   * INSERT ALL INSERT INTO table (column_name1,column_name2)
      with row as (
        SELECT value as "column_name1",value as "column_name2" FROM DUAL UNION ALL
        SELECT value as "column_name1",value as "column_name2" FROM DUAL
      )
    SELECT * FROM row
   * Unfortunately, with version minor 11 and sequences, we can't use this, we have to chain multiple insert queries
   */
  bulkInsertQuery(tableName, attrValueHashes, options, attributes) {
    const query = 'INSERT ALL INTO <%= table %> (<%= attributes %>) WITH rowAttr AS (<%= rows %>) SELECT * FROM rowAttr;'
      , emptyQuery = 'INSERT INTO <%= table %> (<%= attributes %>) VALUES (DEFAULT)'
      , tuples = []
      , allAttributes = [];
    let allQueries = [];

    Utils._.forEach(attrValueHashes, attrValueHash => {
      // special case for empty objects with primary keys
      const fields = Object.keys(attrValueHash);
      if (fields.length === 1 && attributes[fields[0]].autoIncrement && attrValueHash[fields[0]] === null) {
        allQueries.push(emptyQuery);
        return;
      }

      // normal case
      Utils._.forOwn(attrValueHash, (value, key) => {
        if (allAttributes.indexOf(key) === -1) {
          if (value === null && attributes[key].autoIncrement)
            return;

          allAttributes.push(key);
        }
      });
    });

    //Loop over each row to insert
    if (allAttributes.length > 0) {
      //Loop over each attribute
      Utils._.forEach(attrValueHashes, (attrValueHash, idx, array) => {
        //Generating the row
        let row = 'SELECT ';
        const attrs = allAttributes.map(key => {
          return this.escape(attrValueHash[key]) + ' AS "' + key + '"';
        }).join(',');
        row += attrs;
        row += idx < array.length - 1 ? ' FROM DUAL UNION ALL' : ' FROM DUAL';
        tuples.push(row);
      });
      allQueries.push(query);

    } else {
      //If we pass here, we don't have any attribute, just the id, so we take it to place it in the queries
      let queryToLaunch = "DECLARE x NUMBER := 0; BEGIN LOOP EXECUTE IMMEDIATE '";
      queryToLaunch += allQueries[0];
      queryToLaunch += "'; x:= x+1; IF x > ";
      queryToLaunch += (allQueries.length - 1);
      queryToLaunch += ' THEN EXIT; END IF; END LOOP; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;';

      allQueries = [queryToLaunch];
      allAttributes.push(Object.keys(attrValueHashes[0])[0]);
    }

    const replacements = {
      table: this.quoteTable(tableName),
      attributes: allAttributes.map(attr => {
        return this.quoteIdentifier(attr);
      }).join(','),
      rows: tuples.join(' ')
    };

    return Utils._.template(allQueries.join(';'))(replacements);
  },

  deleteQuery(tableName, where, options) {
    options = options || {};

    const table = tableName;
    if (options.truncate === true) {
      // Truncate does not allow LIMIT and WHERE
      return 'TRUNCATE TABLE ' + table;
    }

    where = this.getWhereConditions(where);
    let limit = '';
    const query = 'DELETE FROM <%= table %><%= where %><%= limit %>;';

    if (!!options.limit) {
      //Style of drop with limit with Oracle : delete from table where rowid IN (select rowid from table where rownum <= 10)
      //If where have de drop statement inside where (as unit test delete.test.js), we don't do anything on limit
      //We can add a limit
      if (where.length > 0) {
        //Where clause, we add this at the end
        limit = ' AND rowid IN(SELECT rowid FROM <%= table %> WHERE rownum <=' + options.limit + ')';
      } else {
        //No where clause, create one
        limit = ' WHERE rowid IN(SELECT rowid FROM <%= table %> WHERE rownum <=' + options.limit + ')';
      }
    }

    const replacements = {
      limit,
      table: this.quoteTable(table),
      where,
    };

    if (replacements.where) {
      replacements.where = ' WHERE ' + replacements.where;
    }

    return Utils._.template(query)(replacements);
  },

  showIndexesQuery(tableName) {
    let owner = '';

    if (_.isPlainObject(tableName)) {
      owner = tableName.schema;
      tableName = tableName.tableName;
    }

    const sql = ['SELECT i.index_name,i.table_name, i.column_name, u.uniqueness, i.descend ',
      'FROM all_ind_columns i ',
      'INNER JOIN all_indexes u ',
      'ON (u.table_name = i.table_name AND u.index_name = i.index_name) ',
      'WHERE (i.table_name = UPPER(\'<%= tableName %>\') OR i.table_name = \'<%= tableName %>\')',
      owner.length > 0 ? ' AND u.TABLE_OWNER = \'' + this.getOwnerToGoodCase(owner) + '\'' : '',
      ' ORDER BY INDEX_NAME, COLUMN_NAME'];

    const request = sql.join('');
    return Utils._.template(request)({
      tableName
    });
  },

  removeIndexQuery(tableName, indexNameOrAttributes) {
    const sql = 'DROP INDEX <%= indexName %>';
    let indexName = indexNameOrAttributes;

    if (typeof indexName !== 'string') {
      indexName = Utils.underscore(tableName + '_' + indexNameOrAttributes.join('_'));
    }

    const values = {
      tableName,
      indexName
    };

    return Utils._.template(sql)(values);
  },

  attributeToSQL(attribute) {
    if (!Utils._.isPlainObject(attribute)) {
      attribute = {
        type: attribute
      };
    }

    // handle self referential constraints
    if (attribute.references) {

      if (attribute.Model && attribute.Model.tableName === attribute.references.model) {
        this.sequelize.log('Oracle does not support self referencial constraints, '
          + 'we will remove it but we recommend restructuring your query');
        attribute.onDelete = '';
        attribute.onUpdate = '';
      }
    }

    let template;

    if (attribute.type instanceof DataTypes.ENUM) {
      if (attribute.type.values && !attribute.values) attribute.values = attribute.type.values;

      // enums are a special case
      template = attribute.type.toSql();
      template += ' CHECK (ATTRIBUTENAME IN(' + Utils._.map(attribute.values, value => {
        return this.escape(value);
      }).join(', ') + '))';
      return template;
    } else {
      if (attribute.autoIncrement) {
        template = ' NUMBER(*,0) GENERATED BY DEFAULT ON NULL AS IDENTITY';
      } else {
        if (attribute.type && attribute.type.key === DataTypes.DOUBLE.key) {
          template = attribute.type.toSql();
        } else {
          if (attribute.type) {
            template = attribute.type.toString();
          } else {
            template = '';
          }
        }
      }
    }

    // Blobs/texts cannot have a defaultValue
    if (attribute.type && attribute.type !== 'TEXT' && attribute.type._binary !== true &&
      Utils.defaultValueSchemable(attribute.defaultValue)) {
      template += ' DEFAULT ' + this.escape(attribute.defaultValue);
    }

    if (!attribute.autoIncrement) {
      //If autoincrement, not null is setted automatically
      if (attribute.allowNull === false) {
        template += ' NOT NULL';
      } else if (!attribute.primaryKey && !Utils.defaultValueSchemable(attribute.defaultValue)) {
        template += ' NULL';
      }
    }


    if (attribute.unique === true && !attribute.primaryKey) {
      template += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      template += ' PRIMARY KEY';
    }

    if (attribute.references) {
      template += ' REFERENCES ' + this.quoteTable(attribute.references.model);

      if (attribute.references.key) {
        template += ' (' + attribute.references.key + ')';
      } else {
        template += ' (' + 'id' + ')';
      }

      if (attribute.onDelete) {
        template += ' ON DELETE ' + attribute.onDelete.toUpperCase();
      }

      //Not supported by Oracle
      //if (attribute.onUpdate) {    template += ' ON UPDATE ' + attribute.onUpdate.toUpperCase();    }
    }

    return template;
  },

  attributesToSQL(attributes, options) {
    const result = {};

    for (const key in attributes) {
      const attribute = attributes[key];
      const attributeName = attribute.field || key;
      result[attributeName] = this.attributeToSQL(attribute, options).replace('ATTRIBUTENAME', attributeName);
    }

    return result;
  },

  findAutoIncrementField(factory) {
    const fields = [];
    for (const name in factory.attributes) {
      if (factory.attributes.hasOwnProperty(name)) {
        const definition = factory.attributes[name];

        if (definition && definition.autoIncrement) {
          fields.push(name);
        }
      }
    }

    return fields;
  },

  createTrigger() {
    throwMethodUndefined('createTrigger');
  },

  dropTrigger() {
    throwMethodUndefined('dropTrigger');
  },

  renameTrigger() {
    throwMethodUndefined('renameTrigger');
  },

  createFunction() {
    throwMethodUndefined('createFunction');
  },

  dropFunction() {
    throwMethodUndefined('dropFunction');
  },

  renameFunction() {
    throwMethodUndefined('renameFunction');
  },

  /**
   * Method for setting the good case to the name passed in parameter used for defining the correct case for the owner
   * Method to use ONLY for parameters in SYSTEM TABLES ! (in this case, owner used to be uppercase, except if it's a reserved word)
   */
  getOwnerToGoodCase(name) {

    if (Utils._.includes(oracleReservedWords, name.toUpperCase())) {
      //The name is reserved, we return in normal case
      return name;
    } else {
      //The name is not reserved, we return in uppercase
      return name.toUpperCase();
    }
  },

  quoteIdentifier(identifier, force) {
    if (identifier === '*') {
      return identifier;
    } 

    if (force === true) {
      return Utils.addTicks(identifier, '"');
    } else if (identifier.indexOf('.') > - 1 || identifier.indexOf('->') > - 1) {
      return Utils.addTicks(identifier, '"');
    } else {
      //If there is a reserved word, we have to quote it

      if (Utils._.includes(oracleReservedWords, identifier.toUpperCase())) {
        return Utils.addTicks(identifier, '"');
      }
      return identifier;
    }
  },

  getConstraintsOnColumn(table, column) {
    const tableName = table.tableName || table;

    const sql = ['SELECT CONSTRAINT_NAME FROM user_cons_columns WHERE TABLE_NAME = \'',
      tableName.toUpperCase(),
      '\' ',
      table.schema ? ' and OWNER = \'' + this.getOwnerToGoodCase(table.schema) + '\'' : '',
      ' and COLUMN_NAME = \'',
      column.toUpperCase(),
      '\' AND POSITION IS NOT NULL ORDER BY POSITION'].join('');

    return sql;
  },

  getForeignKeysQuery(table) {
    //We don't call quoteTable as we don't want the schema in the table name, Oracle seperates it on another field
    const tableName = table.tableName || table;
    const sql = ['select table_name,constraint_name, owner from all_constraints where constraint_type in (\'U\', \'R\') and table_name = \'',
      tableName.toUpperCase(),
      '\'',
      table.schema ? ' and owner = \'' + this.getOwnerToGoodCase(table.schema) + '\'' : '',
      ' order by table_name, constraint_name'].join('');

    return sql;
  },


  quoteTable(param, as) {
    let table = '';

    if (_.isObject(param)) {
      if (param.schema) {
        table += this.quoteIdentifier(param.schema) + '.';
      }
      if (Utils._.includes(oracleReservedWords, param.tableName.toUpperCase()) || param.tableName.indexOf('_') === 0) {
        table += this.quoteIdentifier(param.tableName, true);
      } else {
        table += this.quoteIdentifier(param.tableName);
      }
    } else {
      //If there is a reserved word, we have to quote it
      if (Utils._.includes(oracleReservedWords, param.toUpperCase()) || param.indexOf('_') === 0) {
        table = this.quoteIdentifier(param, true);
      } else {
        table = this.quoteIdentifier(param);
      }
    }

    //Oracle don't support as for table aliases
    if (as) {
      if (as.indexOf('.') > - 1 || as.indexOf('_') === 0) {
        table += ' ' + this.quoteIdentifier(as, true);
      } else {
        table += ' ' + this.quoteIdentifier(as);
      }
    }
    return table;
  },

  nameIndexes(indexes, rawTablename) {
    return Utils._.map(indexes, index => {
      if (!index.hasOwnProperty('name')) {
        const onlyAttributeNames = index.fields.map(field => (typeof field === 'string') ? field : (field.name || field.attribute));
        let indexName = Utils.underscore(rawTablename + '_' + onlyAttributeNames.join('_'));
        if (indexName.indexOf('[') > -1 || indexName.indexOf(']') > -1 || indexName.indexOf('(') > -1 || indexName.indexOf(')') > -1) {
          //If we have special characters, we have to quote everything
          indexName = `"${indexName}"`;
        }
        index.name = indexName;
      }

      return index;
    });
  },

  dropForeignKeyQuery(tableName, foreignKey) {
    return this.dropConstraintQuery(tableName, foreignKey);
  },

  getPrimaryKeyConstraintQuery(tableName) {

    const sql = ['SELECT cols.column_name, atc.identity_column ',
      'FROM all_constraints cons, all_cons_columns cols ',
      'INNER JOIN all_tab_columns atc ON(atc.table_name = cols.table_name AND atc.COLUMN_NAME = cols.COLUMN_NAME )',
      'WHERE cols.table_name = \'',
      tableName.tableName ? tableName.tableName.toUpperCase() : tableName.toUpperCase(),
      '\' ',
      tableName.schema ? 'AND cols.owner = \'' + this.getOwnerToGoodCase(tableName.schema) + '\' ' : ' ',
      'AND cons.constraint_type = \'P\' ',
      'AND cons.constraint_name = cols.constraint_name ',
      'AND cons.owner = cols.owner ',
      'ORDER BY cols.table_name, cols.position'].join('');

    return sql;
  },

  /**
   * Request to know if the table has a identity primary key, returns the name of the declaration of the identity if true
   */
  isIdentityPrimaryKey(tableName) {
    return ['SELECT TABLE_NAME,COLUMN_NAME, COLUMN_NAME,GENERATION_TYPE,IDENTITY_OPTIONS FROM DBA_TAB_IDENTITY_COLS WHERE TABLE_NAME=\'',
      tableName.tableName ? tableName.tableName.toUpperCase() : tableName.toUpperCase(),
      '\' ',
      tableName.schema ? 'AND OWNER = \'' + this.getOwnerToGoodCase(tableName.schema) + '\' ' : ' '].join('');
  },

  /**
   * Drop identity
   * Mandatory, Oracle doesn't support dropping a PK column if it's an identity -> results in database corruption
   */
  dropIdentityColumn(tableName, columnName) {
    const table = this.quoteTable(tableName);

    return 'ALTER TABLE ' + table + ' MODIFY ' + columnName + ' DROP IDENTITY';
  },

  dropConstraintQuery(tableName, constraintName) {
    const sql = 'ALTER TABLE <%= table %> DROP CONSTRAINT "<%= constraint %>"';

    return Utils._.template(sql)({
      table: this.quoteTable(tableName),
      constraint: constraintName
    });
  },

  setAutocommitQuery(value) {
    if (value) {
      //Do nothing, just for eslint
    }
    return '';
  },

  setIsolationLevelQuery(value, options) {
    if (options.parent) {
      return;
    }

    //We force the transaction level to the highest to have consistent datas 
    return 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED;';
  },

  generateTransactionId() {
    //Oracle doesn't support transaction names > 32...
    //To deal with -savepoint-XX , we generate the uuid and then get the crc32 of it
    return crc32(uuid.v4());
  },

  startTransactionQuery(transaction) {
    if (transaction.parent) {
      return 'SAVEPOINT "' + transaction.name + '"';
    }

    return 'BEGIN TRANSACTION';
  },

  commitTransactionQuery(transaction) {
    if (transaction.parent) {
      return;
    }

    return 'COMMIT TRANSACTION';
  },

  rollbackTransactionQuery(transaction) {
    if (transaction.parent) {
      return 'ROLLBACK TO SAVEPOINT "' + transaction.name + '"';
    }

    return 'ROLLBACK TRANSACTION';
  },

  selectFromTableFragment(options, model, attributes, tables, mainTableAs) {
    let mainFragment = 'SELECT ' + attributes.join(', ') + ' FROM ' + tables;

    if (mainTableAs) {
      mainFragment += ' ' + mainTableAs;
    }

    return mainFragment;
  },

  addLimitAndOffset(options, model) {
    let fragment = '';
    const offset = options.offset || 0
      , isSubQuery = options.hasIncludeWhere || options.hasIncludeRequired || options.hasMultiAssociation;

    let orders = {};
    if (options.order) {
      orders = this.getQueryOrders(options, model, isSubQuery);
    }

    if (options.limit || options.offset) {
      if (!options.order || (options.include && !orders.subQueryOrder.length)) {
        fragment += (options.order && !isSubQuery) ? ', ' : ' ORDER BY ';
        fragment += model.primaryKeyField;
      }

      if (options.offset || options.limit) {
        fragment += ' OFFSET ' + this.escape(offset) + ' ROWS';
      }

      if (options.limit) {
        fragment += ' FETCH NEXT ' + this.escape(options.limit) + ' ROWS ONLY';
      }
    }

    return fragment;
  },

  booleanValue(value) {
    return !!value ? 1 : 0;
  }

};

// private methods
function wrapSingleQuote(identifier) {
  return Utils.addTicks(identifier, "'");
}

module.exports = Utils._.extend(Utils._.clone(AbstractQueryGenerator), QueryGenerator);
