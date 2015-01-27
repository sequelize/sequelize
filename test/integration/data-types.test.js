'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Sequelize = require(__dirname + '/../../index')
  , Support = require(__dirname + '/support');

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('DataTypes'), function() {
  it('should return false when comparing DECIMAL and DECIMAL(10,2)', function(done) {
    expect(Sequelize.DECIMAL).to.not.equal(Sequelize.DECIMAL(10, 2));
    done();
  });

  it('DECIMAL(10,2) should be an instance of DECIMAL', function(done) {
    expect(Sequelize.DECIMAL(10, 2)).to.be.an.instanceof(Sequelize.DECIMAL);
    done();
  });

  it('should return false when comparing FLOAT and FLOAT(11)', function(done) {
    expect(Sequelize.FLOAT).to.not.equal(Sequelize.FLOAT(11));
    done();
  });

  it('FLOAT(11) should be an instance of FLOAT', function(done) {
    expect(Sequelize.FLOAT(11)).to.be.an.instanceof(Sequelize.FLOAT);
    done();
  });

  it('should return false when comparing STRING and STRING(4096)', function(done) {
    expect(Sequelize.STRING).to.not.equal(Sequelize.STRING(4096));
    done();
  });

  it('STRING(4096) should be an instance of STRING', function(done) {
    expect(Sequelize.STRING(4096)).to.be.an.instanceof(Sequelize.STRING);
    done();
  });

  it('should return false when comparing BIGINT and BIGINT(11)', function(done) {
    expect(Sequelize.BIGINT).to.not.equal(Sequelize.BIGINT(11));
    done();
  });

  it('BIGINT(11) should be an instance of BIGINT', function(done) {
    expect(Sequelize.BIGINT(11)).to.be.an.instanceof(Sequelize.BIGINT);
    done();
  });

  var tests = [
    [Sequelize.STRING, 'STRING', 'VARCHAR(255)'],
    [Sequelize.STRING(1234), 'STRING(1234)', 'VARCHAR(1234)'],
    [Sequelize.STRING(1234).BINARY, 'STRING(1234).BINARY', 'VARCHAR(1234) BINARY'],
    [Sequelize.STRING.BINARY, 'STRING.BINARY', 'VARCHAR(255) BINARY'],

    [Sequelize.CHAR, 'CHAR(255)', 'CHAR(255)'],
    [Sequelize.CHAR(12), 'CHAR(12)', 'CHAR(12)'],
    [Sequelize.CHAR(12).BINARY, 'CHAR(12).BINARY', 'CHAR(12) BINARY'],
    [Sequelize.CHAR.BINARY, 'CHAR(255).BINARY', 'CHAR(255) BINARY'],

    [Sequelize.TEXT, 'TEXT', 'TEXT'],
    [Sequelize.DATE, 'DATE', 'DATETIME'],
    [Sequelize.TIME, 'TIME', 'TIME'],
    [Sequelize.NOW, 'NOW', 'NOW'],
    [Sequelize.UUID, 'UUID', 'UUID'],
    [Sequelize.BOOLEAN, 'BOOLEAN', 'TINYINT(1)'],

    [Sequelize.BLOB, 'BLOB', 'BLOB'],
    [Sequelize.BLOB('tiny'), 'BLOB(\'tiny\')', 'TINYBLOB'],
    [Sequelize.BLOB('medium'), 'BLOB(\'medium\')', 'MEDIUMBLOB'],
    [Sequelize.BLOB('long'), 'BLOB(\'long\')', 'LONGBLOB'],
   
    [Sequelize.INTEGER, 'INTEGER', 'INTEGER'],
    [Sequelize.INTEGER.UNSIGNED, 'INTEGER.UNSIGNED', 'INTEGER UNSIGNED'],
    [Sequelize.INTEGER.UNSIGNED.ZEROFILL, 'INTEGER.UNSIGNED', 'INTEGER UNSIGNED ZEROFILL'],
    [Sequelize.INTEGER(11), 'INTEGER(11)', 'INTEGER(11)'],
    [Sequelize.INTEGER(11).UNSIGNED, 'INTEGER(11).UNSIGNED', 'INTEGER(11) UNSIGNED'],
    [Sequelize.INTEGER(11).UNSIGNED.ZEROFILL, 'INTEGER(11).UNSIGNED.ZEROFILL', 'INTEGER(11) UNSIGNED ZEROFILL'],
    [Sequelize.INTEGER(11).ZEROFILL, 'INTEGER(11).ZEROFILL', 'INTEGER(11) ZEROFILL'],
    [Sequelize.INTEGER(11).ZEROFILL.UNSIGNED, 'INTEGER(11).ZEROFILL.UNSIGNED', 'INTEGER(11) UNSIGNED ZEROFILL'],
    
    [Sequelize.BIGINT, 'BIGINT', 'BIGINT'],
    [Sequelize.BIGINT.UNSIGNED, 'BIGINT.UNSIGNED', 'BIGINT UNSIGNED'],
    [Sequelize.BIGINT(11), 'BIGINT(11)', 'BIGINT(11)'],
    [Sequelize.BIGINT(11).UNSIGNED, 'BIGINT(11).UNSIGNED', 'BIGINT(11) UNSIGNED'],
    [Sequelize.BIGINT(11).UNSIGNED.ZEROFILL, 'BIGINT(11).UNSIGNED.ZEROFILL', 'BIGINT(11) UNSIGNED ZEROFILL'],
    [Sequelize.BIGINT(11).ZEROFILL, 'BIGINT(11).ZEROFILL', 'BIGINT(11) ZEROFILL'],
    [Sequelize.BIGINT(11).ZEROFILL.UNSIGNED, 'BIGINT(11).ZEROFILL.UNSIGNED', 'BIGINT(11) UNSIGNED ZEROFILL'],

    [Sequelize.FLOAT, 'FLOAT', 'FLOAT'],
    [Sequelize.FLOAT.UNSIGNED, 'FLOAT.UNSIGNED', 'FLOAT UNSIGNED'],
    [Sequelize.FLOAT(11), 'FLOAT(11)', 'FLOAT(11)'],
    [Sequelize.FLOAT(11).UNSIGNED, 'FLOAT(11).UNSIGNED', 'FLOAT(11) UNSIGNED'],
    [Sequelize.FLOAT(11).UNSIGNED.ZEROFILL, 'FLOAT(11).UNSIGNED.ZEROFILL', 'FLOAT(11) UNSIGNED ZEROFILL'],
    [Sequelize.FLOAT(11).ZEROFILL, 'FLOAT(11).ZEROFILL', 'FLOAT(11) ZEROFILL'],
    [Sequelize.FLOAT(11).ZEROFILL.UNSIGNED, 'FLOAT(11).ZEROFILL.UNSIGNED', 'FLOAT(11) UNSIGNED ZEROFILL'],

    [Sequelize.FLOAT(11, 12), 'FLOAT(11,12)', 'FLOAT(11,12)'],
    [Sequelize.FLOAT(11, 12).UNSIGNED, 'FLOAT(11,12).UNSIGNED', 'FLOAT(11,12) UNSIGNED'],
    [Sequelize.FLOAT(11, 12).UNSIGNED.ZEROFILL, 'FLOAT(11,12).UNSIGNED.ZEROFILL', 'FLOAT(11,12) UNSIGNED ZEROFILL'],
    [Sequelize.FLOAT(11, 12).ZEROFILL, 'FLOAT(11,12).ZEROFILL', 'FLOAT(11,12) ZEROFILL'],
    [Sequelize.FLOAT(11, 12).ZEROFILL.UNSIGNED, 'FLOAT(11,12).ZEROFILL.UNSIGNED', 'FLOAT(11,12) UNSIGNED ZEROFILL'],

    [Sequelize.DECIMAL, 'DECIMAL', 'DECIMAL'],
    [Sequelize.DECIMAL(10, 2), 'DECIMAL(10,2)', 'DECIMAL(10,2)']
  ];

  tests.forEach(function(test) {
    it('transforms "' + test[1] + '" to "' + test[2] + '"', function(done) {
      if (Support.getTestDialect() === 'mssql') {
        switch (test[1]) {
          case 'STRING':
            test[2] = 'NVARCHAR(255)';
            break;
          case 'STRING(1234)':
            test[2] = 'NVARCHAR(1234)';
            break;
          case 'STRING(1234).BINARY':
            test[2] = 'BINARY(1234)';
            break;
          case 'STRING.BINARY':
            test[2] = 'BINARY(255)';
            break;
        }
      }

      if (typeof test[0] === "function") test[0] = new test[0]();
      expect(test[0].toSql()).to.equal(test[2]);
      done();
    });
  });
});
