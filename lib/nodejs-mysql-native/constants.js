var flags = exports.flags = 
{
  CLIENT_LONG_PASSWORD:	1	,/* new more secure passwords */
  CLIENT_FOUND_ROWS:	2	,/* Found instead of affected rows */
  CLIENT_LONG_FLAG:	4	,/* Get all column flags */
  CLIENT_CONNECT_WITH_DB:	8	,/* One can specify db on connect */
  CLIENT_NO_SCHEMA:	16	,/* Don't allow database.table.column */
  CLIENT_COMPRESS:		32	,/* Can use compression protocol */
  CLIENT_ODBC:		64	,/* Odbc client */
  CLIENT_LOCAL_FILES:	128	,/* Can use LOAD DATA LOCAL */
  CLIENT_IGNORE_SPACE:	256	,/* Ignore spaces before '(' */
  CLIENT_PROTOCOL_41:	512	,/* New 4.1 protocol */
  CLIENT_INTERACTIVE:	1024	,/* This is an interactive client */
  CLIENT_SSL:              2048	,/* Switch to SSL after handshake */
  CLIENT_IGNORE_SIGPIPE:   4096    ,/* IGNORE sigpipes */
  CLIENT_TRANSACTIONS:	8192	,/* Client knows about transactions */
  CLIENT_RESERVED:         16384   ,/* Old flag for 4.1 protocol  */
  CLIENT_SECURE_CONNECTION: 32768  ,/* New 4.1 authentication */
  CLIENT_MULTI_STATEMENTS: 65536   ,/* Enable/disable multi-stmt support */
  CLIENT_MULTI_RESULTS:    131072  /* Enable/disable multi-results */
}

exports.field_flags = 
{
    NOT_NULL:   1,               /* Field can't be NULL */
    PRI_KEY:    2,               /* Field is part of a primary key */
    UNIQUE_KEY: 4,               /* Field is part of a unique key */
    MULTIPLE_KEY: 8,             /* Field is part of a key */
    BLOB:       16,              /* Field is a blob */
    UNSIGNED:   32,              /* Field is unsigned */
    ZEROFILL:   64,              /* Field is zerofill */
    BINARY:     128, 
}

exports.flags.CLIENT_BASIC_FLAGS = flags.CLIENT_LONG_PASSWORD | 
                       flags.CLIENT_FOUND_ROWS | 
                       flags.CLIENT_LONG_FLAG | 
                       flags.CLIENT_CONNECT_WITH_DB | 
                       flags.CLIENT_ODBC | 
                       flags.CLIENT_LOCAL_FILES | 
                       flags.CLIENT_IGNORE_SPACE | 
                       flags.CLIENT_PROTOCOL_41 | 
                       flags.CLIENT_INTERACTIVE |
                       flags.CLIENT_IGNORE_SIGPIPE | 
                       flags.CLIENT_TRANSACTIONS | 
                       flags.CLIENT_RESERVED | 
                       flags.CLIENT_SECURE_CONNECTION | 
                       flags.CLIENT_MULTI_STATEMENTS | 
                       flags.CLIENT_MULTI_RESULTS;  

exports.types = 
{
  MYSQL_TYPE_DECIMAL: 0,
  MYSQL_TYPE_TINY: 1,
  MYSQL_TYPE_SHORT: 2,
  MYSQL_TYPE_LONG: 3,
  MYSQL_TYPE_FLOAT: 4,
  MYSQL_TYPE_DOUBLE: 5,
  MYSQL_TYPE_NULL: 6,
  MYSQL_TYPE_TIMESTAMP: 7,
  MYSQL_TYPE_LONGLONG: 8,
  MYSQL_TYPE_INT24: 9,
  MYSQL_TYPE_DATE: 10,
  MYSQL_TYPE_TIME: 11,
  MYSQL_TYPE_DATETIME: 12,
  MYSQL_TYPE_YEAR: 13,
  MYSQL_TYPE_NEWDATE: 14,
  MYSQL_TYPE_VARCHAR: 15,
  MYSQL_TYPE_BIT: 16,
  MYSQL_TYPE_NEWDECIMAL: 246,
  MYSQL_TYPE_ENUM: 247,
  MYSQL_TYPE_SET: 248,
  MYSQL_TYPE_TINY_BLOB: 249,
  MYSQL_TYPE_MEDIUM_BLOB: 250,
  MYSQL_TYPE_LONG_BLOB: 251,
  MYSQL_TYPE_BLOB: 252,
  MYSQL_TYPE_VAR_STRING: 253,
  MYSQL_TYPE_STRING: 254,
  MYSQL_TYPE_GEOMETR: 255
};

exports.type_names = {};

for (var tname in exports.types)
{
   if(exports.types.hasOwnProperty(tname) )
   {
       var type = exports.types[tname];
       exports.type_names[type] = tname;
   }
}
