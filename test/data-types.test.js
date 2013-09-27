var chai      = require('chai')
  , expect    = chai.expect
  , Sequelize = require(__dirname + '/../index')
  , Support   = require(__dirname + '/support')

chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser('DataTypes'), function() {
  it('should return DECIMAL for the default decimal type', function(done) {
    expect(Sequelize.DECIMAL.toString()).to.equal('DECIMAL')
    done()
  })

  it('should return DECIMAL(10,2) for the default decimal type with arguments', function(done) {
    expect(Sequelize.DECIMAL(10, 2)).to.equal('DECIMAL(10,2)')
    done()
  })

  var tests = [
    [Sequelize.STRING, 'STRING', 'VARCHAR(255)'],
    [Sequelize.STRING(1234), 'STRING(1234)', 'VARCHAR(1234)'],
    [Sequelize.STRING(1234).BINARY, 'STRING(1234).BINARY', 'VARCHAR(1234) BINARY'],
    [Sequelize.STRING.BINARY, 'STRING.BINARY', 'VARCHAR(255) BINARY'],

    [Sequelize.TEXT, 'TEXT', 'TEXT'],
    [Sequelize.DATE, 'DATE', 'DATETIME'],
    [Sequelize.NOW, 'NOW', 'NOW'],
    [Sequelize.BOOLEAN, 'BOOLEAN', 'TINYINT(1)'],

    [Sequelize.BLOB, 'BLOB', 'BLOB'],
    [Sequelize.BLOB('tiny'), 'BLOB(\'tiny\')', 'TINYBLOB'],
    [Sequelize.BLOB('medium'), 'BLOB(\'medium\')', 'MEDIUMBLOB'],
    [Sequelize.BLOB('long'), 'BLOB(\'long\')', 'LONGBLOB'],

    [Sequelize.INTEGER, 'INTEGER', 'INTEGER'],
    [Sequelize.INTEGER.UNSIGNED, 'INTEGER.UNSIGNED', 'INTEGER UNSIGNED'],
    [Sequelize.INTEGER(11), 'INTEGER(11)','INTEGER(11)'],
    [Sequelize.INTEGER(11).UNSIGNED, 'INTEGER(11).UNSIGNED', 'INTEGER(11) UNSIGNED'],
    [Sequelize.INTEGER(11).UNSIGNED.ZEROFILL,'INTEGER(11).UNSIGNED.ZEROFILL','INTEGER(11) UNSIGNED ZEROFILL'],
    [Sequelize.INTEGER(11).ZEROFILL,'INTEGER(11).ZEROFILL', 'INTEGER(11) ZEROFILL'],
    [Sequelize.INTEGER(11).ZEROFILL.UNSIGNED,'INTEGER(11).ZEROFILL.UNSIGNED', 'INTEGER(11) UNSIGNED ZEROFILL'],

    [Sequelize.BIGINT, 'BIGINT', 'BIGINT'],
    [Sequelize.BIGINT.UNSIGNED, 'BIGINT.UNSIGNED', 'BIGINT UNSIGNED'],
    [Sequelize.BIGINT(11), 'BIGINT(11)','BIGINT(11)'],
    [Sequelize.BIGINT(11).UNSIGNED, 'BIGINT(11).UNSIGNED', 'BIGINT(11) UNSIGNED'],
    [Sequelize.BIGINT(11).UNSIGNED.ZEROFILL, 'BIGINT(11).UNSIGNED.ZEROFILL','BIGINT(11) UNSIGNED ZEROFILL'],
    [Sequelize.BIGINT(11).ZEROFILL, 'BIGINT(11).ZEROFILL', 'BIGINT(11) ZEROFILL'],
    [Sequelize.BIGINT(11).ZEROFILL.UNSIGNED, 'BIGINT(11).ZEROFILL.UNSIGNED', 'BIGINT(11) UNSIGNED ZEROFILL'],

    [Sequelize.FLOAT, 'FLOAT', 'FLOAT'],
    [Sequelize.FLOAT.UNSIGNED, 'FLOAT.UNSIGNED', 'FLOAT UNSIGNED'],
    [Sequelize.FLOAT(11), 'FLOAT(11)','FLOAT(11)'],
    [Sequelize.FLOAT(11).UNSIGNED, 'FLOAT(11).UNSIGNED', 'FLOAT(11) UNSIGNED'],
    [Sequelize.FLOAT(11).UNSIGNED.ZEROFILL,'FLOAT(11).UNSIGNED.ZEROFILL','FLOAT(11) UNSIGNED ZEROFILL'],
    [Sequelize.FLOAT(11).ZEROFILL,'FLOAT(11).ZEROFILL', 'FLOAT(11) ZEROFILL'],
    [Sequelize.FLOAT(11).ZEROFILL.UNSIGNED,'FLOAT(11).ZEROFILL.UNSIGNED', 'FLOAT(11) UNSIGNED ZEROFILL'],

    [Sequelize.FLOAT(11, 12), 'FLOAT(11,12)','FLOAT(11,12)'],
    [Sequelize.FLOAT(11, 12).UNSIGNED, 'FLOAT(11,12).UNSIGNED', 'FLOAT(11,12) UNSIGNED'],
    [Sequelize.FLOAT(11, 12).UNSIGNED.ZEROFILL,'FLOAT(11,12).UNSIGNED.ZEROFILL','FLOAT(11,12) UNSIGNED ZEROFILL'],
    [Sequelize.FLOAT(11, 12).ZEROFILL,'FLOAT(11,12).ZEROFILL', 'FLOAT(11,12) ZEROFILL'],
    [Sequelize.FLOAT(11, 12).ZEROFILL.UNSIGNED,'FLOAT(11,12).ZEROFILL.UNSIGNED', 'FLOAT(11,12) UNSIGNED ZEROFILL']
  ]

  tests.forEach(function(test) {
    it('transforms "' + test[1] + '" to "' + test[2] + '"', function(done) {
      expect(test[0].toString()).to.equal(test[2])
      done()
    })
  })
})
