/* jshint multistr: true */

if (typeof require === 'function') {
  var buster             = require("buster")
    , Helpers            = require('./buster-helpers')
    , dialect            = Helpers.getTestDialect()
}

buster.spec.expose()
buster.testRunner.timeout = 2000

describe(Helpers.getTestDialectTeaser("QueryGenerators"), function() {
  before(function(done) {
    Helpers.initTests({
      dialect: dialect,
      beforeComplete: function(sequelize, DataTypes) {
        this.sequelize = sequelize
        this.DataTypes = DataTypes
      }.bind(this),
      onComplete: function() {
        this.interface = this.sequelize.getQueryInterface()
        done()
      }.bind(this)
    })
  })

  describe("comments", function() {
    it("should create a comment for a column", function(done) {
      var self = this
        , User = this.sequelize.define('User', {
          username: {type: this.DataTypes.STRING, comment: 'Some lovely info for my DBA'}
        })

      User.sync().success(function(){
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
          expect(true).toBeTrue()
          return done()
        } else {
          console.log('FIXME: This dialect is not supported :(');
          expect(true).toBeTrue()
          return done()
        }

        self.sequelize.query(sql, null, {raw: true}).success(function(result) {
          expect(result[0].cmt).toEqual('Some lovely info for my DBA');
          done()
        })
      })
    })
  })
})
