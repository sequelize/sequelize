'use strict';

var Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , util      = require('util')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , sql       = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

suite(Support.getTestDialectTeaser('SQL'), function() {
  suite('DataTypes', function () {
    var testsql = function (description, dataType, expectation) {
      test(description, function () {
        return expectsql(current.normalizeDataType(dataType).toSql(), expectation);
      });
    };

    suite('STRING', function () {
      testsql('STRING', DataTypes.STRING, {
        default: 'VARCHAR(255)',
        mssql: 'NVARCHAR(255)'
      });

      testsql('STRING(1234)', DataTypes.STRING(1234), {
        default: 'VARCHAR(1234)',
        mssql: 'NVARCHAR(1234)'
      });

      testsql('STRING(1234).BINARY', DataTypes.STRING(1234).BINARY, {
        default: 'VARCHAR(1234) BINARY',
        sqlite: 'VARCHAR BINARY(1234)',
        mssql: 'BINARY(1234)',
        postgres: 'BYTEA'
      });

      testsql('STRING.BINARY', DataTypes.STRING.BINARY, {
        default: 'VARCHAR(255) BINARY',
        sqlite: 'VARCHAR BINARY(255)',
        mssql: 'BINARY(255)',
        postgres: 'BYTEA'
      });
    });

    suite('CHAR', function () {
      testsql('CHAR', DataTypes.CHAR, {
        default: 'CHAR(255)'
      });

      testsql('CHAR(12)', DataTypes.CHAR(12), {
        default: 'CHAR(12)'
      });

      testsql('CHAR(12).BINARY', DataTypes.CHAR(12).BINARY, {
        default: 'CHAR(12) BINARY',
        sqlite: 'CHAR BINARY(12)',
        postgres: 'BYTEA'
      });

      testsql('CHAR.BINARY', DataTypes.CHAR.BINARY, {
        default: 'CHAR(255) BINARY',
        sqlite: 'CHAR BINARY(255)',
        postgres: 'BYTEA'
      });
    });

    suite('BOOLEAN', function () {
      testsql('BOOLEAN', DataTypes.BOOLEAN, {
        postgres: 'BOOLEAN',
        mssql: 'BIT',
        mysql: 'TINYINT(1)',
        sqlite: 'TINYINT(1)'
      });
    });

    suite('DATE', function () {
      testsql('DATE', DataTypes.DATE, {
        postgres: 'TIMESTAMP WITH TIME ZONE',
        mssql: 'DATETIME2',
        mysql: 'DATETIME',
        sqlite: 'DATETIME'
      });
    });

    suite('UUID', function () {
      testsql('UUID', DataTypes.UUID, {
        postgres: 'UUID',
        mssql: 'CHAR(36)',
        mysql: 'CHAR(36) BINARY',
        sqlite: 'UUID'
      });
    });

    suite('NOW', function () {
      testsql('NOW', DataTypes.NOW, {
        default: 'NOW',
        mssql: 'GETDATE()'
      });
    });

    suite('INTEGER', function () {
      testsql('INTEGER', DataTypes.INTEGER, {
        default: 'INTEGER'
      });

      testsql('INTEGER.UNSIGNED', DataTypes.INTEGER.UNSIGNED, {
        default: 'INTEGER UNSIGNED'
      });

      testsql('INTEGER.UNSIGNED.ZEROFILL', DataTypes.INTEGER.UNSIGNED.ZEROFILL, {
        default: 'INTEGER UNSIGNED ZEROFILL'
      });

      testsql('INTEGER(11)', DataTypes.INTEGER(11), {
        default: 'INTEGER(11)',
        postgres: 'INTEGER'
      });

      testsql('INTEGER(11).UNSIGNED', DataTypes.INTEGER(11).UNSIGNED, {
        default: 'INTEGER(11) UNSIGNED',
        sqlite: 'INTEGER UNSIGNED(11)',
        postgres: 'INTEGER UNSIGNED'
      });

      testsql('INTEGER(11).UNSIGNED.ZEROFILL', DataTypes.INTEGER(11).UNSIGNED.ZEROFILL, {
        default: 'INTEGER(11) UNSIGNED ZEROFILL',
        sqlite: 'INTEGER UNSIGNED ZEROFILL(11)',
        postgres: 'INTEGER UNSIGNED ZEROFILL'
      });

      testsql('INTEGER(11).ZEROFILL', DataTypes.INTEGER(11).ZEROFILL, {
        default: 'INTEGER(11) ZEROFILL',
        sqlite: 'INTEGER ZEROFILL(11)',
        postgres: 'INTEGER ZEROFILL'
      });

      testsql('INTEGER(11).ZEROFILL.UNSIGNED', DataTypes.INTEGER(11).ZEROFILL.UNSIGNED, {
        default: 'INTEGER(11) UNSIGNED ZEROFILL',
        sqlite: 'INTEGER UNSIGNED ZEROFILL(11)',
        postgres: 'INTEGER UNSIGNED ZEROFILL'
      });
    });

    suite('BIGINT', function () {
      testsql('BIGINT', DataTypes.BIGINT, {
        default: 'BIGINT'
      });

      testsql('BIGINT.UNSIGNED', DataTypes.BIGINT.UNSIGNED, {
        default: 'BIGINT UNSIGNED'
      });

      testsql('BIGINT.UNSIGNED.ZEROFILL', DataTypes.BIGINT.UNSIGNED.ZEROFILL, {
        default: 'BIGINT UNSIGNED ZEROFILL'
      });

      testsql('BIGINT(11)', DataTypes.BIGINT(11), {
        default: 'BIGINT(11)',
        postgres: 'BIGINT'
      });

      testsql('BIGINT(11).UNSIGNED', DataTypes.BIGINT(11).UNSIGNED, {
        default: 'BIGINT(11) UNSIGNED',
        sqlite: 'BIGINT UNSIGNED(11)',
        postgres: 'BIGINT UNSIGNED'
      });

      testsql('BIGINT(11).UNSIGNED.ZEROFILL', DataTypes.BIGINT(11).UNSIGNED.ZEROFILL, {
        default: 'BIGINT(11) UNSIGNED ZEROFILL',
        sqlite: 'BIGINT UNSIGNED ZEROFILL(11)',
        postgres: 'BIGINT UNSIGNED ZEROFILL'
      });

      testsql('BIGINT(11).ZEROFILL', DataTypes.BIGINT(11).ZEROFILL, {
        default: 'BIGINT(11) ZEROFILL',
        sqlite: 'BIGINT ZEROFILL(11)',
        postgres: 'BIGINT ZEROFILL'
      });

      testsql('BIGINT(11).ZEROFILL.UNSIGNED', DataTypes.BIGINT(11).ZEROFILL.UNSIGNED, {
        default: 'BIGINT(11) UNSIGNED ZEROFILL',
        sqlite: 'BIGINT UNSIGNED ZEROFILL(11)',
        postgres: 'BIGINT UNSIGNED ZEROFILL'
      });
    });

    suite('FLOAT', function () {
      testsql('FLOAT', DataTypes.FLOAT, {
        default: 'FLOAT'
      });

      testsql('FLOAT.UNSIGNED', DataTypes.FLOAT.UNSIGNED, {
        default: 'FLOAT UNSIGNED'
      });

      testsql('FLOAT(11)', DataTypes.FLOAT(11), {
        default:  'FLOAT(11)'
      });

      testsql('FLOAT(11).UNSIGNED', DataTypes.FLOAT(11).UNSIGNED, {
        default: 'FLOAT(11) UNSIGNED',
        sqlite: 'FLOAT UNSIGNED(11)'
      });

      testsql('FLOAT(11).UNSIGNED.ZEROFILL', DataTypes.FLOAT(11).UNSIGNED.ZEROFILL, {
        default: 'FLOAT(11) UNSIGNED ZEROFILL',
        sqlite: 'FLOAT UNSIGNED ZEROFILL(11)'
      });

      testsql('FLOAT(11).ZEROFILL', DataTypes.FLOAT(11).ZEROFILL, {
        default: 'FLOAT(11) ZEROFILL',
        sqlite: 'FLOAT ZEROFILL(11)'
      });

      testsql('FLOAT(11).ZEROFILL.UNSIGNED', DataTypes.FLOAT(11).ZEROFILL.UNSIGNED, {
        default: 'FLOAT(11) UNSIGNED ZEROFILL',
        sqlite: 'FLOAT UNSIGNED ZEROFILL(11)'
      });


      testsql('FLOAT(11, 12)', DataTypes.FLOAT(11, 12), {
        default: 'FLOAT(11,12)'
      });

      testsql('FLOAT(11, 12).UNSIGNED', DataTypes.FLOAT(11, 12).UNSIGNED, {
        default: 'FLOAT(11,12) UNSIGNED',
        sqlite: 'FLOAT UNSIGNED(11,12)'
      });

      testsql('FLOAT(11, 12).UNSIGNED.ZEROFILL', DataTypes.FLOAT(11, 12).UNSIGNED.ZEROFILL, {
        default: 'FLOAT(11,12) UNSIGNED ZEROFILL',
        sqlite: 'FLOAT UNSIGNED ZEROFILL(11,12)'
      });

      testsql('FLOAT(11, 12).ZEROFILL', DataTypes.FLOAT(11, 12).ZEROFILL, {
        default: 'FLOAT(11,12) ZEROFILL',
        sqlite: 'FLOAT ZEROFILL(11,12)'
      });

      testsql('FLOAT(11, 12).ZEROFILL.UNSIGNED', DataTypes.FLOAT(11, 12).ZEROFILL.UNSIGNED, {
        default: 'FLOAT(11,12) UNSIGNED ZEROFILL',
        sqlite: 'FLOAT UNSIGNED ZEROFILL(11,12)'
      });

    });

    suite('DECIMAL', function () {
      testsql('DECIMAL', DataTypes.DECIMAL, {
        default: 'DECIMAL'
      });

      testsql('DECIMAL(10, 2)', DataTypes.DECIMAL(10, 2), {
        default: 'DECIMAL(10,2)'
      });

      testsql('DECIMAL(10)', DataTypes.DECIMAL(10), {
        default: 'DECIMAL(10)'
      });
    });

    suite('BLOB', function () {
      testsql("BLOB", DataTypes.BLOB, {
        default: 'BLOB',
        mssql: 'VARBINARY(MAX)',
        postgres: 'BYTEA'
      });

      testsql("BLOB('tiny')", DataTypes.BLOB('tiny'), {
        default: 'TINYBLOB',
        mssql: 'VARBINARY(MAX)',
        postgres: 'BYTEA'
      });

      testsql("BLOB('medium')", DataTypes.BLOB('medium'), {
        default: 'MEDIUMBLOB',
        mssql: 'VARBINARY(MAX)',
        postgres: 'BYTEA'
      });

      testsql("BLOB('long')", DataTypes.BLOB('long'), {
        default: 'LONGBLOB',
        mssql: 'VARBINARY(MAX)',
        postgres: 'BYTEA'
      });
    });

    if (current.dialect.supports.ARRAY) {
      suite('ARRAY', function () {
        testsql("ARRAY(VARCHAR)", DataTypes.ARRAY(DataTypes.STRING), {
          postgres: 'VARCHAR(255)[]'
        });

        testsql("ARRAY(VARCHAR(100))", DataTypes.ARRAY(DataTypes.STRING(100)), {
          postgres: 'VARCHAR(100)[]'
        });
      });
    }
  });
});