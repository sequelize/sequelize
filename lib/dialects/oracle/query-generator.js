'use strict';

/* jshint -W110 */
const Utils = require('../../utils');
const DataTypes = require('../../data-types');
const AbstractQueryGenerator = require('../abstract/query-generator');
const semver = require('semver');
const _ = require('lodash');
const crc32 = require('js-crc').crc32;
const uuid = require('uuid');

//List of Oracle reserved words https://docs.oracle.com/cd/B19306_01/em.102/b40103/app_oracle_reserved_words.htm
const oracleReservedWords = ['ACCESS','ACCOUNT','ACTIVATE','ADD','ADMIN','ADVISE','AFTER','ALL','ALL_ROWS','ALLOCATE','ALTER','ANALYZE','AND','ANY','ARCHIVE','ARCHIVELOG','ARRAY','AS','ASC','AT','AUDIT','AUTHENTICATED','AUTHORIZATION','AUTOEXTEND','AUTOMATIC','BACKUP','BECOME','BEFORE','BEGIN','BETWEEN','BFILE','BITMAP','BLOB','BLOCK','BODY','BY','CACHE','CACHE_INSTANCES','CANCEL','CASCADE','CAST','CFILE','CHAINED','CHANGE','CHAR','CHAR_CS','CHARACTER','CHECK','CHECKPOINT','CHOOSE','CHUNK','CLEAR','CLOB','CLONE','CLOSE','CLOSE_CACHED_OPEN_CURSORS','CLUSTER','COALESCE','COLUMN','COLUMNS','COMMENT','COMMIT','COMMITTED','COMPATIBILITY','COMPILE','COMPLETE','COMPOSITE_LIMIT','COMPRESS','COMPUTE','CONNECT','CONNECT_TIME','CONSTRAINT','CONSTRAINTS','CONTENTS','CONTINUE','CONTROLFILE','CONVERT','COST','CPU_PER_CALL','CPU_PER_SESSION','CREATE','CURRENT','CURRENT_SCHEMA','CURREN_USER','CURSOR','CYCLE','DANGLING','DATABASE','DATAFILE','DATAFILES','DATAOBJNO','DATE','DBA','DBHIGH','DBLOW','DBMAC','DEALLOCATE','DEBUG','DEC','DECIMAL','DECLARE','DEFAULT','DEFERRABLE','DEFERRED','DEGREE','DELETE','DEREF','DESC','DIRECTORY','DISABLE','DISCONNECT','DISMOUNT','DISTINCT','DISTRIBUTED','DML','DOUBLE','DROP','DUMP','EACH','ELSE','ENABLE','END','ENFORCE','ENTRY','ESCAPE','EXCEPT','EXCEPTIONS','EXCHANGE','EXCLUDING','EXCLUSIVE','EXECUTE','EXISTS','EXPIRE','EXPLAIN','EXTENT','EXTENTS','EXTERNALLY','FAILED_LOGIN_ATTEMPTS','FALSE','FAST','FILE','FIRST_ROWS','FLAGGER','FLOAT','FLOB','FLUSH','FOR','FORCE','FOREIGN','FREELIST','FREELISTS','FROM','FULL','FUNCTION','GLOBAL','GLOBALLY','GLOBAL_NAME','GRANT','GROUP','GROUPS','HASH','HASHKEYS','HAVING','HEADER','HEAP','IDENTIFIED','IDGENERATORS','IDLE_TIME','IF','IMMEDIATE','IN','INCLUDING','INCREMENT','INDEX','INDEXED','INDEXES','INDICATOR','IND_PARTITION','INITIAL','INITIALLY','INITRANS','INSERT','INSTANCE','INSTANCES','INSTEAD','INT','INTEGER','INTERMEDIATE','INTERSECT','INTO','IS','ISOLATION','ISOLATION_LEVEL','KEEP','KEY','KILL','LABEL','LAYER','LESS','LEVEL','LIBRARY','LIKE','LIMIT','LINK','LIST','LOB','LOCAL','LOCK','LOCKED','LOG','LOGFILE','LOGGING','LOGICAL_READS_PER_CALL','LOGICAL_READS_PER_SESSION','LONG','MANAGE','MASTER','MAX','MAXARCHLOGS','MAXDATAFILES','MAXEXTENTS','MAXINSTANCES','MAXLOGFILES','MAXLOGHISTORY','MAXLOGMEMBERS','MAXSIZE','MAXTRANS','MAXVALUE','MIN','MEMBER','MINIMUM','MINEXTENTS','MINUS','MINVALUE','MLSLABEL','MLS_LABEL_FORMAT','MODE','MODIFY','MOUNT','MOVE','MTS_DISPATCHERS','MULTISET','NATIONAL','NCHAR','NCHAR_CS','NCLOB','NEEDED','NESTED','NETWORK','NEW','NEXT','NOARCHIVELOG','NOAUDIT','NOCACHE','NOCOMPRESS','NOCYCLE','NOFORCE','NOLOGGING','NOMAXVALUE','NOMINVALUE','NONE','NOORDER','NOOVERRIDE','NOPARALLEL','NOPARALLEL','NOREVERSE','NORMAL','NOSORT','NOT','NOTHING','NOWAIT','NULL','NUMBER','NUMERIC','NVARCHAR2','OBJECT','OBJNO','OBJNO_REUSE','OF','OFF','OFFLINE','OID','OIDINDEX','OLD','ON','ONLINE','ONLY','OPCODE','OPEN','OPTIMAL','OPTIMIZER_GOAL','OPTION','OR','ORDER','ORGANIZATION','OSLABEL','OVERFLOW','OWN','PACKAGE','PARALLEL','PARTITION','PASSWORD','PASSWORD_GRACE_TIME','PASSWORD_LIFE_TIME','PASSWORD_LOCK_TIME','PASSWORD_REUSE_MAX','PASSWORD_REUSE_TIME','PASSWORD_VERIFY_FUNCTION','PCTFREE','PCTINCREASE','PCTTHRESHOLD','PCTUSED','PCTVERSION','PERCENT','PERMANENT','PLAN','PLSQL_DEBUG','POST_TRANSACTION','PRECISION','PRESERVE','PRIMARY','PRIOR','PRIVATE','PRIVATE_SGA','PRIVILEGE','PRIVILEGES','PROCEDURE','PROFILE','PUBLIC','PURGE','QUEUE','QUOTA','RANGE','RAW','RBA','READ','READUP','REAL','REBUILD','RECOVER','RECOVERABLE','RECOVERY','REF','REFERENCES','REFERENCING','REFRESH','RENAME','REPLACE','RESET','RESETLOGS','RESIZE','RESOURCE','RESTRICTED','RETURN','RETURNING','REUSE','REVERSE','REVOKE','ROLE','ROLES','ROLLBACK','ROW','ROWID','ROWNUM','ROWS','RULE','SAMPLE','SAVEPOINT','SB4','SCAN_INSTANCES','SCHEMA','SCN','SCOPE','SD_ALL','SD_INHIBIT','SD_SHOW','SEGMENT','SEG_BLOCK','SEG_FILE','SELECT','SEQUENCE','SERIALIZABLE','SESSION','SESSION_CACHED_CURSORS','SESSIONS_PER_USER','SET','SHARE','SHARED','SHARED_POOL','SHRINK','SIZE','SKIP','SKIP_UNUSABLE_INDEXES','SMALLINT','SNAPSHOT','SOME','SORT','SPECIFICATION','SPLIT','SQL_TRACE','STANDBY','START','STATEMENT_ID','STATISTICS','STOP','STORAGE','STORE','STRUCTURE','SUCCESSFUL','SWITCH','SYS_OP_ENFORCE_NOT_NULL$','SYS_OP_NTCIMG$','SYNONYM','SYSDATE','SYSDBA','SYSOPER','SYSTEM','TABLE','TABLES','TABLESPACE','TABLESPACE_NO','TABNO','TEMPORARY','THAN','THE','THEN','THREAD','TIMESTAMP','TIME','TO','TOPLEVEL','TRACE','TRACING','TRANSACTION','TRANSITIONAL','TRIGGER','TRIGGERS','TRUE','TRUNCATE','TX','TYPE','UB2','UBA','UID','UNARCHIVED','UNDO','UNION','UNIQUE','UNLIMITED','UNLOCK','UNRECOVERABLE','UNTIL','UNUSABLE','UNUSED','UPDATABLE','UPDATE','USAGE','USE','USER','USING','VALIDATE','VALIDATION','VALUE','VALUES','VARCHAR','VARCHAR2','VARYING','VIEW','WHEN','WHENEVER','WHERE','WITH','WITHOUT','WORK','WRITE','WRITEDOWN','WRITEUP','XID','YEAR','ZONE'];

/* istanbul ignore next */
var throwMethodUndefined = function (methodName) {
  throw new Error('The method "' + methodName + '" is not defined! Please add it to your sql dialect.');
};

var OracleQueryGenerator = _.extend(
  _.clone(require('../abstract/query-generator'))
);

var QueryGenerator = {
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
      '    EXECUTE IMMEDIATE ', wrapSingleQuote('CREATE USER ' + schema + ' IDENTIFIED BY 12345'), ';',
      '    EXECUTE IMMEDIATE ', wrapSingleQuote('GRANT create session TO ' + schema), ';',
      '    EXECUTE IMMEDIATE ', wrapSingleQuote('GRANT create table TO ' + schema), ';',
      '    EXECUTE IMMEDIATE ', wrapSingleQuote('GRANT create view TO ' + schema), ';',
      '    EXECUTE IMMEDIATE ', wrapSingleQuote('GRANT create any trigger TO ' + schema), ';',
      '    EXECUTE IMMEDIATE ', wrapSingleQuote('GRANT create any procedure TO ' + schema), ';',
      '    EXECUTE IMMEDIATE ', wrapSingleQuote('GRANT create sequence TO ' + schema), ';',
      '    EXECUTE IMMEDIATE ', wrapSingleQuote('GRANT create synonym TO ' + schema), ';',
      '    EXECUTE IMMEDIATE ', wrapSingleQuote('GRANT UNLIMITED TABLESPACE TO ' + schema), ';',
      '  END IF;',
      'END;'
    ].join(' ');
  },



  showSchemasQuery() {
    return 'SELECT USERNAME AS "schema_name" FROM ALL_USERS WHERE COMMON = (\'NO\') AND USERNAME != user';
  },

  dropSchema(tableName, options) {
    return 'DROP USER ' + this.quoteTable(tableName) + ' CASCADE';
  },

  versionQuery() {
    return 'SELECT * FROM V$VERSION';
  },


  createTableQuery(tableName, attributes, options) {
    let query = "CREATE TABLE <%= table %> (<%= attributes %>)"
      , primaryKeys = [], foreignKeys = {}, attrStr = [], checkStr = [], self = this;

    const regex = /REFERENCES ([a-zA-Z_.0-9]*) \((.*)\)/g; //Global regex
    // const secondRegex = /REFERENCES ("[a-zA-Z_.0-9]*") \(([a-zA-Z_.0-9]*)\)/g; //Regex if references already escaped
    const subst = `REFERENCES \$1 (\$2)`; //Global replacement
    // const subst2 = `REFERENCES \$1 ("\$2")`; //Replacement if references already escaped

    const chkRegex = /CHECK \(([a-zA-Z_.0-9]*) (.*)\)/g; //Check regex
    const substChk = `CHECK ("\$1" $2)`; //Replacement for check

    for (let attr in attributes) {
      if (attributes.hasOwnProperty(attr)) {
        let dataType = attributes[attr], match;

        attr = this.quoteIdentifier(attr);

        // ORACLE doesn't support inline REFERENCES declarations: move to the end
        if (Utils._.includes(dataType, 'PRIMARY KEY')) {
          //Primary key
          primaryKeys.push(attr);
          if (Utils._.includes(dataType, 'REFERENCES')) {
            match = dataType.match(/^(.+) (REFERENCES.*)$/);
            attrStr.push(attr) + ' ' + match[1].replace(/PRIMARY KEY/, '');
            
            foreignKeys[attr] = match[2].replace(regex, (match, table, column, offset, s) => {
              //We don't want the table name to be quoted if we pass the schema name
              let tableName = "";
              if(Utils._.isPlainObject(table)) {
                if(table.schema) {
                  tableName = this.quoteTable(table.schema) + '.';
                }
                tableName += this.quoteTable(table.tableName);
              } else {
                tableName = oracleReservedWords.includes(table.toUpperCase()) ? '"' + table + '"' : table;
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

          foreignKeys[attr] = match[2].replace(regex, (match, table, column, offset, s) => {
            //We don't want the table name to be quoted if we pass the schema name
            let tableName = "";
            if(Utils._.isPlainObject(table)) {
              if(table.schema) {
                tableName = this.quoteTable(table.schema) + '.';
              }
              tableName += this.quoteTable(table.tableName);
            } else {
              tableName = oracleReservedWords.includes(table.toUpperCase()) ? '"' + table + '"' : table
            }

            return `REFERENCES ${tableName} (${this.quoteIdentifier(column)})`;
          });
        } else if (Utils._.includes(dataType, 'CHECK')) {
          //Check constraints go to the end
          match = dataType.match(/^(.+) (CHECK.*)$/);
          attrStr.push(attr + ' ' + match[1]);
          match[2] = match[2].replace('ATTRIBUTENAME',attr);
          let checkCond = match[2].replace(chkRegex, (match, column, condition, offset, s) => {
              return `CHECK (${this.quoteIdentifier(column)} ${condition})`;
            });

          checkStr.push(checkCond);
        } else {
          attrStr.push(attr + ' ' + dataType);
        }
      }
    }

    let values = {
      table: this.quoteTable(tableName),
      attributes: attrStr.join(', ')
    };
    let pkString = primaryKeys.map((pk => {
         return this.quoteIdentifier(pk); 
      }).bind(this)).join(', ');

    if (pkString.length > 0) {
      let primaryKeyName = `PK${values.table}${pkString}`.replace(/[.,"\s]/g,''); //We replace the space if there are multiple columns

      //Oracle doesn't support names with more that 32 characters, so we replace it by PK timestamp
      if(primaryKeyName.length > 30) {
        primaryKeyName = `PK${values.table}${crc32(pkString)}`.replace(/[.,"\s]/g,'');
        if(primaryKeyName.length > 30) {
          let crcName = crc32(`${values.table}_${pkString}`);
          primaryKeyName = `PK${crcName}`.replace(/[.,"\s]/g,'');
        }
      }

      values.attributes += ',CONSTRAINT ' + primaryKeyName + ' PRIMARY KEY (' + pkString + ')';
    }

    for (let fkey in foreignKeys) {
      if (foreignKeys.hasOwnProperty(fkey)) {

        //Oracle default response for FK, doesn't support if defined
        if(foreignKeys[fkey].indexOf('ON DELETE NO ACTION') > - 1) {
          foreignKeys[fkey] = foreignKeys[fkey].replace('ON DELETE NO ACTION', '');
        }
        
        let fkName = `FK${values.table}${fkey}`.replace(/[."]/g,'');
        //Oracle doesn't support names with more that 32 characters, so we replace it by PK timestamp
        if(fkName.length > 30) {
          fkName = `FK${values.table}${crc32(fkey)}`.replace(/[."]/g,'');
          //If the name is still too long (table name very long), we generate only FKCRC
          if(fkName.length > 30) {
            let crcName = crc32(`${values.table}_${fkey}`);
            fkName = `FK${crcName}`.replace(/[."]/g,'');
          }
        }

        values.attributes += ',CONSTRAINT ' + fkName + ' FOREIGN KEY (' + this.quoteIdentifier(fkey) + ') ' + foreignKeys[fkey];
      }
    }

    if(checkStr.length > 0) {
      values.attributes += ', ' + checkStr.join(', ');
    }

    if (options && !!options.uniqueKeys) {
      Utils._.each(options.uniqueKeys, (columns, indexName) => {
        let canBeUniq = false;

        //Check if we can create the unique key
        primaryKeys.forEach(primaryKey => {
          //We can create an unique constraint if it's not on the primary key AND if it doesn't have unique in its definition
          if(!columns.fields.includes(primaryKey)) {
            canBeUniq = true;
          }
        });

        columns.fields.forEach(field => {
          let currField = field.replace(/[.,"\s]/g,'');
          if(currField in attributes) {
            if(attributes[currField].toUpperCase().indexOf('UNIQUE') > -1) {
              //We generate the attribute without UNIQUE
              let attrToReplace = attributes[currField].replace('UNIQUE','');
              //We replace in the final string
              values.attributes = values.attributes.replace(attributes[currField], attrToReplace);
            }
          }
        });
        
        //Oracle cannot have an unique AND a primary key on the same fields, prior to the primary key 
        if(canBeUniq) {
          if (!Utils._.isString(indexName)) {
            indexName = `${uniq}${values.table}${columns.fields.join('')}`.replace(/[.,"\s]/g,'');
          }

          //Oracle doesn't support names with more that 32 characters, so we replace it by PK timestamp
          if(indexName.length > 30) {
            indexName = `uniq${values.table}${crc32(columns.fields.join(''))}`.replace(/[.,"\s]/g,'');

            if(indexName.length > 30) {
              let crcName = crc32(`${values.table}_${columns.fields.join('')}`);
              indexName = `uniq${crcName}`.replace(/[.,"\s]/g,'');
            }
          }

          let indexUpperName = indexName.toUpperCase();

          for(let i = 0; i < oracleReservedWords.length; i++) {

            if(indexUpperName.indexOf(oracleReservedWords[i]) > -1 && indexUpperName.indexOf('"') === -1) {
              indexName = '"' + indexName + '"';
              break;
            }
          }

          let index = options.uniqueKeys[columns.name];
          delete options.uniqueKeys[columns.name];
          columns.name = indexName;
          options.uniqueKeys[indexName] = index
          // options.uniqueKeys[]
          values.attributes += ', CONSTRAINT ' + indexName + ' UNIQUE (' + Utils._.map(columns.fields, self.quoteIdentifier).join(', ') + ')';
        }
      });
    }

    let completeQuery = "BEGIN"
      + " EXECUTE IMMEDIATE '<%= createTableQuery %>';"
      + " EXCEPTION"
      + " WHEN OTHERS THEN"
      + " IF SQLCODE != -955 THEN"
      + " RAISE;"
      + " END IF;"
      + " END;"

    query = Utils._.template(query)(values).trim();

    //we replace single quotes by two quotes in order for the execute statement to work
    query = query.replace(/'/g,"''");

    values.createTableQuery = query; 

    return Utils._.template(completeQuery)(values).trim();
  },

  describeTableQuery(tableName, schema) {
    //name, type, datalength (except number / nvarchar), datalength varchar, datalength number, nullable, default value, primary ?
    let sql = ['SELECT atc.COLUMN_NAME, atc.DATA_TYPE, atc.DATA_LENGTH, atc.CHAR_LENGTH, atc.DEFAULT_LENGTH, atc.NULLABLE, ',
    'CASE WHEN ucc.CONSTRAINT_NAME  LIKE\'%PK%\' THEN \'PRIMARY\' ELSE \'\' END AS "PRIMARY" ',
    'FROM all_tab_columns atc ',
    'LEFT OUTER JOIN all_cons_columns ucc ON(atc.table_name = ucc.table_name AND atc.COLUMN_NAME = ucc.COLUMN_NAME ) ',
    schema ? 'WHERE (atc.OWNER=UPPER(\'<%= schema %>\') OR atc.OWNER=\'<%= schema %>\') ' : 'WHERE atc.OWNER=(SELECT USER FROM DUAL) ',
    'AND (atc.TABLE_NAME=UPPER(\'<%= tableName %>\') OR atc.TABLE_NAME=\'<%= tableName %>\')',
    'ORDER BY "PRIMARY", atc.COLUMN_NAME'].join('');

    let currTableName = Utils._.isPlainObject(tableName) ? tableName.tableName : tableName;

    var values = {
      tableName: currTableName,
      schema: schema
    };

    return Utils._.template(sql)(values).trim();
  },

  renameTableQuery(before, after) {
    var query = 'RENAME <%= before %> TO <%= after %>;';
    return Utils._.template(query)({
      before: before,
      after: after
    });
  },

  showTablesQuery() {

    //Carefull, heavy load
    //Thanks http://sqlblog.com/blogs/jamie_thomson/archive/2009/09/08/deriving-a-list-of-tables-in-dependency-order.aspx

    //We search all tables with constraints
    let sql = ["WITH constraint_tree AS (",
    " SELECT DISTINCT a.table_name AS table_name, b.table_name AS parent_table_name, a.owner",
    " FROM dba_constraints a LEFT OUTER JOIN dba_constraints b ON a.r_constraint_name = b.constraint_name AND a.owner = b.owner",
    " WHERE a.owner IN (SELECT USERNAME AS \"schema_name\" FROM ALL_USERS WHERE COMMON = ('NO')) AND a.table_name NOT LIKE '%BIN%')",
    " SELECT DISTINCT table_name, lvl, owner as table_schema FROM (",
    " SELECT a.*, rank() over (partition by table_name order by lvl desc) rnk FROM ( SELECT  table_name, level lvl, owner",
    " FROM  constraint_tree START WITH parent_table_name   IS NULL",
    " CONNECT BY NOCYCLE parent_table_name = PRIOR table_name ) a  ) b WHERE rnk = 1",
    " UNION",
    //From here we search for all tables without any dependency
    " SELECT table_name, 0 AS lvl, OWNER as TABLE_SCHEMA FROM dba_tables WHERE OWNER IN (SELECT USERNAME AS \"schema_name\" FROM ALL_USERS WHERE COMMON = ('NO'))",
    " AND table_name NOT IN (SELECT DISTINCT(table_name) FROM all_cons_columns)",
    //We order by constraints level
    " ORDER BY lvl desc, table_name"].join('');

    return sql;
  },

  dropTableQuery(tableName) {
    let table = "";

    table = this.quoteTable(tableName);

    var query = "BEGIN "
      + "EXECUTE IMMEDIATE 'DROP TABLE <%= table %> CASCADE CONSTRAINTS';"
      + " EXCEPTION"
      + " WHEN OTHERS THEN"
      + " IF SQLCODE != -942 THEN"
      + " RAISE;"
      + " END IF;"
      + " END;"

      // var query = 'DROP TABLE <%= table %> CASCADE CONSTRAINTS';

    var values = {
      table
    };

    return Utils._.template(query)(values).trim();
  },

  addColumnQuery(table, key, dataType) {
    // FIXME: attributeToSQL SHOULD be using attributes in addColumnQuery
    //        but instead we need to pass the key along as the field here
    dataType.field = key;

    var query = 'ALTER TABLE <%= table %> ADD (<%= attribute %>)'
      , attribute = Utils._.template('<%= key %> <%= definition %>')({
        key: key,
        definition: this.attributeToSQL(dataType, {
          context: 'addColumn'
        }).replace('ATTRIBUTENAME',key)
      });

    return Utils._.template(query)({
      table: this.quoteTable(table),
      attribute: attribute
    });
  },

  removeColumnQuery(tableName, attributeName) {
    var query = 'ALTER TABLE <%= tableName %> DROP COLUMN <%= attributeName %>';
    return Utils._.template(query)({
      tableName: this.quoteTable(tableName),
      attributeName: attributeName
    });
  },

  //TODO
  changeColumnQuery(tableName, attributes) {
    var modifyQuery = 'ALTER TABLE <%= tableName %> MODIFY (<%= query %>)';
    var alterQuery = 'ALTER TABLE <%= tableName %> <%= query %>';
    var query = "";
    var attrString = [], constraintString = [];

    for (var attributeName in attributes) {
      var definition = attributes[attributeName];
      if (definition.match(/REFERENCES/)) {
        constraintString.push(Utils._.template('<%= fkName %> FOREIGN KEY (<%= attrName %>) <%= definition %>')({
          fkName: attributeName + '_foreign_idx',
          attrName: attributeName,
          definition: definition.replace(/.+?(?=REFERENCES)/, '')
        }));
      } else {
        attrString.push(Utils._.template('<%= attrName %> <%= definition %>')({
          attrName: attributeName,
          definition: definition
        }));
      }
    }

     var fullQuery = "BEGIN "
      + "EXECUTE IMMEDIATE '<%= fullQuery %>';"
      + " EXCEPTION"
      + " WHEN OTHERS THEN"
      + " IF SQLCODE = -1451 THEN"
      + " EXECUTE IMMEDIATE '<%= secondQuery %>';" //We execute the statement without the NULL / NOT NULL clause if the first statement failed due to this
      + " ELSE"
      + " RAISE;"
      + " END IF;"
      + " END;"

    var finalQuery = '';
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
    let secondQuery = query.replace('NOT NULL','').replace('NULL','');

    return fullQuery = Utils._.template(fullQuery)({
      fullQuery : query,
      secondQuery : secondQuery
    });
  },

  renameColumnQuery(tableName, attrBefore, attributes) {
    var query = "ALTER TABLE <%= tableName %> RENAME COLUMN <%= before %> TO <%= after %>"
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
    throw new Error('Not implemented');

    //All conditions in ON cannot be in the update statement (they are automatically setted by ON)
    if(where && Utils._.isPlainObject(where)) {
      let whereKeys = Object.keys(where);
      whereKeys.forEach(whereKey => {
        let whereObject = where[whereKey];
        let toDeleteKeys = [];
        // let toDeleteKeys = Object.keys(whereObject[0]);
        whereObject.forEach(whereClause => {
          toDeleteKeys.push(Object.keys(whereClause)[0])
        });
        toDeleteKeys.forEach(toDeleteKey => {
          if(toDeleteKey in updateValues) {
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
    insertQuery = insertQuery.replace(`INTO ${this.quoteTable(tableName)}`,'');

    //We had a full where query, we just don't want the WHERE
    whereQuery = whereQuery.replace('WHERE ','');

    let query = `MERGE INTO ${this.quoteTable(tableName)} USING dual ON ${whereQuery} WHEN MATCHED THEN ${updateQuery} WHEN NOT MATCHED THEN ${insertQuery}`;

    return query;
  },

  /*
  * Override of insertQuery, Oracle specific
  */
  insertQuery(table, valueHash, modelAttributes, options) {
    options = options || {};
    _.defaults(options, this.options);

    var query
      // , valueQuery = 'INSERT<%= ignore %> INTO <%= table %> (<%= attributes %>) VALUES (<%= values %>)' //To keep in case it has to be used
      , valueQuery = 'INSERT INTO <%= table %> (<%= attributes %>) VALUES (<%= values %>)'
      , emptyQuery = 'INSERT INTO <%= table %> VALUES (DEFAULT)'
      , outputFragment
      , fields = []
      , values = []
      , primaryKeys = []
      , primaryKeyReturn = []
      , key
      , value
      , identityWrapperRequired = false
      , modelAttributeMap = {}
      , tmpTable = ''         //tmpTable declaration for trigger
      , selectFromTmp = ''    //Select statement for trigger
      , tmpColumns = ''       //Columns for temp table for trigger
      , outputColumns = ''    //Columns to capture into temp table for trigger
      , attribute             //Model attribute holder
      , modelKey;             //key for model


    //We have to specify a variable that will be used as return value for the id
    var returningQuery = "<%=valueQuery %> RETURNING <%=primaryKey %> INTO <%=primaryKeyReturn %>";

    if (modelAttributes) {


      //We search for the primaryKey
      var keys = Object.keys(modelAttributes);
      var idx = 0;

      while (idx < keys.length) {
        var key = keys[idx];
        var attribute = modelAttributes[key];
        if (attribute.primaryKey) {
          primaryKeys.push(attribute);
          
        }
        idx++;
      }

      Utils._.each(modelAttributes, function (attribute, key) {
        modelAttributeMap[key] = attribute;
        if (attribute.field) {
          modelAttributeMap[attribute.field] = attribute;
        }
      });
    }

    if (this._dialect.supports['ON DUPLICATE KEY'] && options.onDuplicate) {
      valueQuery += ' ON DUPLICATE KEY ' + options.onDuplicate;
      emptyQuery += ' ON DUPLICATE KEY ' + options.onDuplicate;
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
          if (modelAttributeMap && modelAttributeMap[key] && modelAttributeMap[key].autoIncrement === true) {
            identityWrapperRequired = true;
          }

          if(modelAttributeMap && modelAttributeMap[key] && !modelAttributeMap[key].allowNull && value.length === 0) {
            //Oracle refuses an insert in not null column with empty value (considered as null)
            value = ' ';
          }
          values.push(this.escape(value, (modelAttributeMap && modelAttributeMap[key]) || undefined, { context: 'INSERT' }));
        }
      }
    }

    let primaryKeyType = "";
    let primaryKey = "";

    primaryKeys.forEach(element => {
      if(element.field.toLowerCase() === 'uid') {
        primaryKey += primaryKey.length > 0 ? ',"uid"' : '"uid"';

        let pkReturn = `$:pkReturnVal;${element.type.toSql()}$`;
        primaryKeyReturn.push(pkReturn);
      } else {
        primaryKey += primaryKey.length > 0 ? ',' + this.quoteIdentifier(element.field) : this.quoteIdentifier(element.field);
        let pkReturn = `$:${element.field};${element.type.toSql()}$`;
        primaryKeyReturn.push(pkReturn);
      }
    });

    //If we want a return AND we haven't specified a primary key in the column list
    if(options.returning && primaryKey == '') {
      let tableKeys = Object.keys(this.sequelize.models);
      let found = false;
      let tableKey = "";
      let currTableName = Utils._.isPlainObject(table) ? table.tableName : table;

      let currentModelKey = tableKeys.find( modelKey => {
        return this.sequelize.models[modelKey].tableName === currTableName;
      });
      
      let currentModel = this.sequelize.models[currentModelKey];
      if((!currentModel || !currentModel.hasPrimaryKeys) && modelAttributes) {
        //We don't have a primaryKey, so we will return the first column inserted
        let field = modelAttributes[Object.keys(modelAttributes)[0]].field;
        if(oracleReservedWords.includes(field.toUpperCase())) {
          //The column name we want to return is a reserved word, so we change it for the request to be OK
          field = 'pkReturnVal'
        }
        let pkReturn = `$:${field};string$`;
        primaryKey = this.quoteIdentifier(modelAttributes[Object.keys(modelAttributes)[0]].field);
        primaryKeyReturn.push(pkReturn);
      } 
    }

    var replacements = {
      // ignore: options.ignore ? this._dialect.supports.IGNORE : '',
      primaryKey: primaryKey,
      primaryKeyReturn: primaryKeyReturn.join(','),
      table: this.quoteTable(table),
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
   */
  bulkInsertQuery(tableName, attrValueHashes, options, attributes) {
    var query = 'INSERT ALL INTO <%= table %> (<%= attributes %>) WITH rowAttr AS (<%= rows %>) SELECT * FROM rowAttr;'
      , emptyQuery = 'INSERT INTO <%= table %> (<%= attributes %>) VALUES (DEFAULT)'
      , tuples = []
      , rows = []
      , allAttributes = []
      , needIdentityInsertWrapper = false
      , allQueries = []
      , outputFragment;

    Utils._.forEach(attrValueHashes, function (attrValueHash) {
      // special case for empty objects with primary keys
      var fields = Object.keys(attrValueHash);
      if (fields.length === 1 && attributes[fields[0]].autoIncrement && attrValueHash[fields[0]] === null) {
        allQueries.push(emptyQuery);
        return;
      }

      // normal case
      Utils._.forOwn(attrValueHash, function (value, key) {
        if (value !== null && attributes[key].autoIncrement) {
          needIdentityInsertWrapper = true;
        }


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
      Utils._.forEach(attrValueHashes, function (attrValueHash, idx, array) {
        //Generating the row
        var row = "SELECT ";
        var attrs = allAttributes.map(function (key) {
          return this.escape(attrValueHash[key]) + ' AS "' + key + '"';
        }.bind(this)).join(',');
        row += attrs;
        row += idx < array.length - 1 ? ' FROM DUAL UNION ALL' : ' FROM DUAL';
        tuples.push(row);
      }.bind(this));
      allQueries.push(query);
    } else {

      //If we pass here, we don't have any attribute, just the id, so we take it to plce it in the queries

      let queryToLaunch = "DECLARE x NUMBER := 0; BEGIN LOOP EXECUTE IMMEDIATE '";
      queryToLaunch += allQueries[0];
      queryToLaunch += "'; x:= x+1; IF x > "
      queryToLaunch += (allQueries.length -1);
      queryToLaunch +=" THEN EXIT; END IF; END LOOP; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF; END;";

      allQueries = [queryToLaunch];

      allAttributes.push(Object.keys(attrValueHashes[0])[0]);
    }

    var replacements = {
      table: this.quoteTable(tableName),
      attributes: allAttributes.map(function (attr) {
        return this.quoteIdentifier(attr);
      }.bind(this)).join(','),
      rows: tuples.join(' ')
    };

    var generatedQuery = Utils._.template(allQueries.join(';'))(replacements);

    return generatedQuery;
  },

  deleteQuery(tableName, where, options) {
    options = options || {};

    var table = tableName;
    if (options.truncate === true) {
      // Truncate does not allow LIMIT and WHERE
      return 'TRUNCATE TABLE ' + table;
    }

    where = this.getWhereConditions(where);
    var limit = ''
      , query = 'DELETE FROM <%= table %><%= where %><%= limit %>;';

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

    var replacements = {
      limit: limit,
      table: this.quoteTable(table),
      where: where,
    };

    if (replacements.where) {
      replacements.where = ' WHERE ' + replacements.where;
    }

    return Utils._.template(query)(replacements);
  },

  showIndexesQuery(tableName) {
    var owner = "";

    if(_.isPlainObject(tableName)) {
      owner = tableName.schema;
      tableName = tableName.tableName;
    }

    var sql = ['SELECT i.index_name,i.table_name, i.column_name, u.uniqueness, i.descend ',
      'FROM all_ind_columns i ',
      'INNER JOIN all_indexes u ',
      'ON (u.table_name = i.table_name AND u.index_name = i.index_name) ',
      'WHERE (i.table_name = UPPER(\'<%= tableName %>\') OR i.table_name = \'<%= tableName %>\')',
      owner.length > 0 ? ' AND u.TABLE_OWNER = \'' + owner + '\'' : '',
      ' ORDER BY INDEX_NAME, COLUMN_NAME'];

    let request = sql.join('');
    return Utils._.template(request)({
      tableName: tableName
    });
  },

  removeIndexQuery(tableName, indexNameOrAttributes) {
    var sql = 'DROP INDEX <%= indexName %>'
      , indexName = indexNameOrAttributes;

    if (typeof indexName !== 'string') {
      indexName = Utils.underscore(tableName + '_' + indexNameOrAttributes.join('_'));
    }

    var values = {
      tableName: tableName,
      indexName: indexName
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
        this.sequelize.log('MSSQL does not support self referencial constraints, '
          + 'we will remove it but we recommend restructuring your query');
        attribute.onDelete = '';
        attribute.onUpdate = '';
      }
    }

    var template;

    if (attribute.type instanceof DataTypes.ENUM) {
      if (attribute.type.values && !attribute.values) attribute.values = attribute.type.values;

      // enums are a special case
      template = attribute.type.toSql();
      template += ' CHECK (ATTRIBUTENAME IN(' + Utils._.map(attribute.values, function (value) {
        return this.escape(value);
      }.bind(this)).join(', ') + '))';
      return template;
    } else {
      if (attribute.autoIncrement) {
        template = ' NUMBER(*,0) GENERATED BY DEFAULT ON NULL AS IDENTITY';
      } else {
        if(attribute.type && attribute.type.key === DataTypes.DOUBLE.key) {
          template = attribute.type.toSql();  
        } else {
          if(attribute.type) {
            template = attribute.type.toString();
          } else {
            template = "";
          }
        }
      }
    }

    // Blobs/texts cannot have a defaultValue
    if (attribute.type && attribute.type !== 'TEXT' && attribute.type._binary !== true &&
      Utils.defaultValueSchemable(attribute.defaultValue)) {
      template += ' DEFAULT ' + this.escape(attribute.defaultValue);
    }

    if(!attribute.autoIncrement) {
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
      result[attribute.field || key] = this.attributeToSQL(attribute, options);
    }

    return result;
  },

  findAutoIncrementField(factory) {
    var fields = [];
    for (var name in factory.attributes) {
      if (factory.attributes.hasOwnProperty(name)) {
        var definition = factory.attributes[name];

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

  quoteIdentifier(identifier, force) {
    if (identifier === '*') return identifier;
    
    if (force === true) {
      return Utils.addTicks(identifier, '"');
    } else if (identifier.indexOf('.') > - 1 || identifier.indexOf('->') > - 1) {
      return Utils.addTicks(identifier, '"');
    } else {
      //If there is a reserved word, we have to quote it
      if(oracleReservedWords.includes(identifier.toUpperCase())) {
        return Utils.addTicks(identifier, '"');
      }
      return identifier;
    }
  },

  getForeignKeysQuery(table) {
    //We don't call quoteTable as we don't want the schema in the table name, Oracle seperates it on another field
    var tableName = table.tableName || table;
    var sql = ['select table_name,constraint_name, owner from all_constraints where constraint_type in (\'U\', \'R\') and table_name = \'',
    tableName.toUpperCase(),
    '\'',
    table.schema ? ' and owner = \'' + table.schema + '\'' : '',
    ' order by table_name, constraint_name'].join('');

    return sql;
  },


  quoteTable(param, as) {
    var table = '';

    if (_.isObject(param)) {
        if (param.schema) {
          table += this.quoteIdentifier(param.schema) + '.';
        }
        if(oracleReservedWords.includes(param.tableName.toUpperCase()) || param.tableName.indexOf('_') === 0) {
          table += this.quoteIdentifier(param.tableName, true);
        } else {
          table += this.quoteIdentifier(param.tableName);
        }
    } else {
      //If there is a reserved word, we have to quote it
      if(oracleReservedWords.includes(param.toUpperCase()) || param.indexOf('_') === 0) {
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
        if(indexName.indexOf('[') > -1 || indexName.indexOf(']') > -1 || indexName.indexOf('(') > -1 || indexName.indexOf(')') > -1) {
          //If we have special characters, we have to quote everything
          indexName = `"${indexName}"`;
        }
        index.name = indexName;
      }

      return index;
    });
  },

  //TODO
  getForeignKeyQuery(table, attributeName) {
    var tableName = table.tableName || table;
    var sql = [
      'SELECT',
      'constraint_name = TC.CONSTRAINT_NAME',
      'FROM',
      'INFORMATION_SCHEMA.TABLE_CONSTRAINTS TC',
      'JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE CCU',
      'ON TC.CONSTRAINT_NAME = CCU.CONSTRAINT_NAME',
      "WHERE TC.CONSTRAINT_TYPE = 'FOREIGN KEY'",
      'AND TC.TABLE_NAME =', wrapSingleQuote(tableName),
      'AND CCU.COLUMN_NAME =', wrapSingleQuote(attributeName),
    ].join(' ');

    if (table.schema) {
      sql += ' AND TC.TABLE_SCHEMA =' + wrapSingleQuote(table.schema);
    }

    return sql;
  },

  dropForeignKeyQuery(tableName, foreignKey) {
    return this.dropConstraintQuery(tableName, foreignKey);
  },

  //TODO
  getDefaultConstraintQuery(tableName, attributeName) {
    var sql = "SELECT name FROM SYS.DEFAULT_CONSTRAINTS " +
      "WHERE PARENT_OBJECT_ID = OBJECT_ID('<%= table %>', 'U') " +
      "AND PARENT_COLUMN_ID = (SELECT column_id FROM sys.columns WHERE NAME = ('<%= column %>') " +
      "AND object_id = OBJECT_ID('<%= table %>', 'U'));";
    return Utils._.template(sql)({
      table: tableName,
      column: attributeName
    });
  },

  dropConstraintQuery(tableName, constraintName) {
    // var sql = 'BEGIN EXECUTE IMMEDIATE \'ALTER TABLE <%= table %> DROP CONSTRAINT <%= constraint %>\'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -2443 THEN RAISE; END IF; END;';

    var sql = 'ALTER TABLE <%= table %> DROP CONSTRAINT <%= constraint %>';

    if(constraintName.indexOf('_') > -1) {
      constraintName = '"' + constraintName + '"';
    }
    return Utils._.template(sql)({
      table: this.quoteTable(tableName),
      constraint: constraintName
    });
  },

  setAutocommitQuery(value) {
    return '';
    // return 'SET IMPLICIT_TRANSACTIONS ' + (!!value ? 'OFF' : 'ON') + ';';
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

  startTransactionQuery(transaction, options) {
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

  rollbackTransactionQuery(transaction, options) {
    if (transaction.parent) {
      return 'ROLLBACK TO SAVEPOINT "' + transaction.name + '"';
    }

    return 'ROLLBACK TRANSACTION';
  },

  selectFromTableFragment(options, model, attributes, tables, mainTableAs, where) {
    var topFragment = '';
    var mainFragment = 'SELECT ' + attributes.join(', ') + ' FROM ' + tables;

    if (mainTableAs) {
      mainFragment += " " + mainTableAs;
    }

    return mainFragment;
  },

  addLimitAndOffset(options, model) {
    // Skip handling of limit and offset as postfixes for older SQL Server versions
    // if(semver.valid(this.sequelize.options.databaseVersion) && semver.lt(this.sequelize.options.databaseVersion, '12.1.0.2.0')) {
    //   return '';
    // }

    var fragment = '';
    var offset = options.offset || 0
      , isSubQuery = options.hasIncludeWhere || options.hasIncludeRequired || options.hasMultiAssociation;

    var orders = {};
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
