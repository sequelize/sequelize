exports.com = {
    SLEEP               : 0,
    QUIT                : 1,
    INIT_DB             : 2,
    QUERY               : 3,
    FIELD_LIST          : 4,
    CREATE_DB           : 5,
    DROP_DB             : 6,
    REFRESH             : 7,
    SHUTDOWN            : 8,
    STATISTICS          : 9,
    PROCESS_INFO        : 10,
    CONNECT             : 11,
    PROCESS_KILL        : 12,
    DEBUG               : 13,
    PING                : 14,
    TIME                : 15,
    DELAYED_INSERT      : 16,
    CHANGE_USER         : 17,
    BINLOG_DUMP         : 18,
    TABLE_DUMP          : 19,
    CONNECT_OUT         : 20,
    REGISTER_SLAVE      : 21,
    STMT_PREPARE        : 22,
    STMT_EXECUTE        : 23,
    STMT_SEND_LONG_DATA : 24,
    STMT_CLOSE          : 25,
    STMT_RESET          : 26,
    SET_OPTION          : 27,
    STMT_FETCH          : 28
};

// Client flag
exports.client = {
    LONG_PASSWORD     : 1,         // new more secure passwords
    FOUND_ROWS        : 1 << 1,    // Found instead of affected rows
    LONG_FLAG         : 1 << 2,    // Get all column flags
    CONNECT_WITH_DB   : 1 << 3,    // One can specify db on connect
    NO_SCHEMA         : 1 << 4,    // Don't allow database.table.column
    COMPRESS          : 1 << 5,    // Can use compression protocol
    ODBC              : 1 << 6,    // Odbc client
    LOCAL_FILES       : 1 << 7,    // Can use LOAD DATA LOCAL
    IGNORE_SPACE      : 1 << 8,    // Ignore spaces before '('
    PROTOCOL_41       : 1 << 9,    // New 4.1 protocol
    INTERACTIVE       : 1 << 10,   // This is an interactive client
    SSL               : 1 << 11,   // Switch to SSL after handshake
    IGNORE_SIGPIPE    : 1 << 12,   // IGNORE sigpipes
    TRANSACTIONS      : 1 << 13,   // Client knows about transactions
    RESERVED          : 1 << 14,   // Old flag for 4.1 protocol
    SECURE_CONNECTION : 1 << 15,   // New 4.1 authentication
    MULTI_STATEMENTS  : 1 << 16,   // Enable/disable multi-stmt support
    MULTI_RESULTS     : 1 << 17   // Enable/disable multi-results
};

// Connection Option
exports.option = {
    OPT_CONNECT_TIMEOUT         : 0,
    OPT_COMPRESS                : 1,
    OPT_NAMED_PIPE              : 2,
    INIT_COMMAND                : 3,
    READ_DEFAULT_FILE           : 4,
    READ_DEFAULT_GROUP          : 5,
    SET_CHARSET_DIR             : 6,
    SET_CHARSET_NAME            : 7,
    OPT_LOCAL_INFILE            : 8,
    OPT_PROTOCOL                : 9,
    SHARED_MEMORY_BASE_NAME     : 10,
    OPT_READ_TIMEOUT            : 11,
    OPT_WRITE_TIMEOUT           : 12,
    OPT_USE_RESULT              : 13,
    OPT_USE_REMOTE_CONNECTION   : 14,
    OPT_USE_EMBEDDED_CONNECTION : 15,
    OPT_GUESS_CONNECTION        : 16,
    SET_CLIENT_IP               : 17,
    SECURE_AUTH                 : 18,
    REPORT_DATA_TRUNCATION      : 19,
    OPT_RECONNECT               : 20,
    OPT_SSL_VERIFY_SERVER_CERT  : 21,

    // Server Option,
    MULTI_STATEMENTS_ON         : 0,
    MULTI_STATEMENTS_OFF        : 1
};

// Server Status
exports.server = {
    STATUS_IN_TRANS             : 1,
    STATUS_AUTOCOMMIT           : 1 << 1,
    MORE_RESULTS_EXISTS         : 1 << 3,
    QUERY_NO_GOOD_INDEX_USED    : 1 << 4,
    QUERY_NO_INDEX_USED         : 1 << 5,
    STATUS_CURSOR_EXISTS        : 1 << 6,
    STATUS_LAST_ROW_SENT        : 1 << 7,
    STATUS_DB_DROPPED           : 1 << 8,
    STATUS_NO_BACKSLASH_ESCAPES : 1 << 9
};

// Refresh parameter
exports.refresh = {
    GRANT     : 1,
    LOG       : 1 << 1,
    TABLES    : 1 << 2,
    HOSTS     : 1 << 3,
    STATUS    : 1 << 4,
    THREADS   : 1 << 5,
    SLAVE     : 1 << 6,
    MASTER    : 1 << 7,
    READ_LOCK : 1 << 14,
    FAST      : 1 << 15
};

exports.field = {
  // Field type
  TYPE_DECIMAL     : 0,
  TYPE_TINY        : 1,
  TYPE_SHORT       : 2,
  TYPE_LONG        : 3,
  TYPE_FLOAT       : 4,
  TYPE_DOUBLE      : 5,
  TYPE_NULL        : 6,
  TYPE_TIMESTAMP   : 7,
  TYPE_LONGLONG    : 8,
  TYPE_INT24       : 9,
  TYPE_DATE        : 10,
  TYPE_TIME        : 11,
  TYPE_DATETIME    : 12,
  TYPE_YEAR        : 13,
  TYPE_NEWDATE     : 14,
  TYPE_VARCHAR     : 15,
  TYPE_BIT         : 16,
  TYPE_NEWDECIMAL  : 246,
  TYPE_ENUM        : 247,
  TYPE_SET         : 248,
  TYPE_TINY_BLOB   : 249,
  TYPE_MEDIUM_BLOB : 250,
  TYPE_LONG_BLOB   : 251,
  TYPE_BLOB        : 252,
  TYPE_VAR_STRING  : 253,
  TYPE_STRING      : 254,
  TYPE_GEOMETRY    : 255,
  TYPE_CHAR        : 1, // TYPE_TINY
  TYPE_INTERVAL    : 247, // TYPE_ENUM

  // Flag
  NOT_NULL_FLAG       : 1,
  PRI_KEY_FLAG        : 1 << 1,
  UNIQUE_KEY_FLAG     : 1 << 2,
  MULTIPLE_KEY_FLAG   : 1 << 3,
  BLOB_FLAG           : 1 << 4,
  UNSIGNED_FLAG       : 1 << 5,
  ZEROFILL_FLAG       : 1 << 6,
  BINARY_FLAG         : 1 << 7,
  ENUM_FLAG           : 1 << 8,
  AUTO_INCREMENT_FLAG : 1 << 9,
  TIMESTAMP_FLAG      : 1 << 10,
  SET_FLAG            : 1 << 11,
  
  PART_KEY_FLAG       : 1 << 14,
  NUM_FLAG            : 1 << 15,
  GROUP_FLAG          : 1 << 15,
  UNIQUE_FLAG         : 1 << 16,
  BINCMP_FLAG         : 1 << 17,
};

exports.stmt = {
  // Cursor type
  CURSOR_TYPE_NO_CURSOR : 0,
  CURSOR_TYPE_READ_ONLY : 1
};


/*
node-mysql
A node.js interface for MySQL

Author: masuidrive <masui@masuidrive.jp>
License: MIT License
Copyright (c) Yuichiro MASUI

# Original:
# http://github.com/tmtm/ruby-mysql
# Copyright (C) 2009-2010 TOMITA Masahiro
# mailto:tommy@tmtm.org
# License: Ruby's
*/
