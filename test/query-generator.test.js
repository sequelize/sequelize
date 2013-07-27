/* jshint multistr: true */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , DataTypes = require(__dirname + "/../lib/data-types")
  , dialect   = Support.getTestDialect()
  , _         = require('lodash')

chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("QueryGenerators"), function () {
  describe("comments", function() {
    it("should create a comment for a column", function(done) {
      var self = this
        , User = this.sequelize.define('User', {
          username: {type: DataTypes.STRING, comment: 'Some lovely info for my DBA'}
        })

      User.sync({ force: true }).success(function() {
        var sql = ''
        if (dialect === "mysql") {
          sql = 'SELECT COLUMN_COMMENT as cmt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = \'' + self.sequelize.config.database + '\' AND TABLE_NAME = \'Users\' AND COLUMN_NAME = \'username\'';
        }
        else if (dialect === "postgres" || dialect === "postgres-native") {
          sql = 'SELECT com.description as cmt FROM pg_attribute a  JOIN pg_class pgc ON pgc.oid = a.attrelid \
                  LEFT JOIN pg_index i ON (pgc.oid = i.indrelid AND i.indkey[0] = a.attnum) \
                  LEFT JOIN pg_description com on (pgc.oid = com.objoid AND a.attnum = com.objsubid) \
                  WHERE a.attnum > 0 AND pgc.oid = a.attrelid AND pg_table_is_visible(pgc.oid) \
                    AND NOT a.attisdropped AND pgc.relname = \'Users\' AND a.attname = \'username\'';
        }
        else if (dialect === "sqlite") {
          // sqlite doesn't support comments except for explicit comments in the file
          expect(true).to.be.true
          return done()
        } else {
          console.log('FIXME: This dialect is not supported :(');
          expect(true).to.be.true
          return done()
        }

        self.sequelize.query(sql, null, {raw: true}).success(function(result) {
          expect(result[0].cmt).to.equal('Some lovely info for my DBA');
          done()
        })
      })
    })
  })
})
