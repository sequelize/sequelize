var config    = require("./config/config")
  , Sequelize = require("../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, { logging: false })
  , Helpers   = new (require("./config/helpers"))(sequelize)

describe('Model', function() {
  describe('Validations', function() {
    var checks = {
      is : {
        spec : { args: [/[a-z]/,'i'] },
        fail: "0",
        pass: "a"
      }
    , not : {
        spec: { args: [/[a-z]/,'i'] },
        fail: "a",
        pass: "0"
      }
    , isEmail : {
        fail: "a",
        pass: "abc@abc.com"
      }
    , isUrl : {
        fail: "abc",
        pass: "http://abc.com"
      }
    , isIP : {
        fail: "abc",
        pass: "129.89.23.1"
      }
    , isAlpha : {
        fail: "012",
        pass: "abc"
      }
    , isAlphanumeric : {
        fail: "_abc019",
        pass: "abc019"
      }
    , isNumeric : {
        fail: "abc",
        pass: "019"
      }
    , isInt : {
        fail: "9.2",
        pass: "-9"
      }
    , isLowercase : {
        fail: "AB",
        pass: "ab"
      }
    , isUppercase : {
        fail: "ab",
        pass: "AB"
      }
    , isDecimal : {
        fail: "a",
        pass: "0.2"
      }
    , isFloat : {
        fail: "a",
        pass: "9.2"
      }
    , notNull : {
        fail: null,
        pass: 0
      }
    , isNull : {
        fail: 0,
        pass: null
      }
    , notEmpty : {
        fail: "       ",
        pass: "a"
      }
    , equals : {
        spec : { args : "bla bla bla" },
        fail: "bla",
        pass: "bla bla bla"
      }
    , contains : {
        spec : { args : "bla" },
        fail: "la",
        pass: "0bla23"
      }
    , notContains : {
        spec : { args : "bla" },
        fail: "0bla23",
        pass: "la"
      }
    , regex : {
        spec : { args: [/[a-z]/,'i'] },
        fail: "0",
        pass: "a"
      }
    , notRegex : {
        spec: { args: [/[a-z]/,'i'] },
        fail: "a",
        pass: "0"
      }
    , len : {
        spec: { args: [2,4] },
        fail: ["1", "12345"],
        pass: ["12", "123", "1234"],
        raw: true
      }
    , isUUID : {
        spec: { args: 4 },
        fail: "f47ac10b-58cc-3372-a567-0e02b2c3d479",
        pass: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
      }
    , isDate : {
        fail: "not a date",
        pass: "2011-02-04"
      }
    , isAfter : {
        spec: { args: "2011-11-05" },
        fail: "2011-11-04",
        pass: "2011-11-05"
      }
    , isBefore : {
        spec: { args: "2011-11-05" },
        fail: "2011-11-06",
        pass: "2011-11-05"
      }
    , isIn : {
        spec: { args: "abcdefghijk" },
        fail: "ghik",
        pass: "ghij"
      }
    , notIn : {
        spec: { args: "abcdefghijk" },
        fail: "ghij",
        pass: "ghik"
      }
    , max : {
        spec: { args: 23 },
        fail: "24",
        pass: "23"
      }
    , min : {
        spec: { args: 23 },
        fail: "22",
        pass: "23"
      }
    , isArray : {
        fail: 22,
        pass: [22]
      }
    , isCreditCard : {
        fail: "401288888888188f",
        pass: "4012888888881881"
      }
    };

    var User, i;

    it('should correctly validate using node-validator methods', function() {
      Helpers.async(function(done) {
        for (var validator in checks) {
          if (checks.hasOwnProperty(validator)) {
            // build spec
            var v = {};
            v[validator] = checks[validator].hasOwnProperty("spec") ? checks[validator].spec : {};

            var check = checks[validator];

            // test for failure
            if (!check.hasOwnProperty("raw"))
              check.fail = new Array(check.fail);

            for (i=0; i<check.fail.length; ++i) {
              v[validator].msg = validator + "(" + check.fail[i] + ")";

              // define user
              User = sequelize.define('User' + Math.random(), {
                name: {
                  type: Sequelize.STRING,
                  validate: v
                }
              });

              var u_fail = User.build({
                name : check.fail[i]
              });
              var errors = u_fail.validate();
              expect(errors).toNotBe(null);
              expect(errors).toEqual({
                name : [v[validator].msg]
              });
            }
            // test for success
            if (!check.hasOwnProperty("raw"))
              check.pass = new Array(check.pass);

            for (i=0; i<check.pass.length; ++i) {
              v[validator].msg = validator + "(" + check.pass[i] + ")";

              // define user
              User = sequelize.define('User' + Math.random(), {
                name: {
                  type: Sequelize.STRING,
                  validate: v
                }
              });

              var u_success = User.build({
                name : check.pass[i]
              });
              expect(u_success.validate()).toBe(null);
            }
          }
        } // for each check

        done();
      });
    });

    it('should correctly validate using custom validation methods', function() {
      Helpers.async(function(done) {
        User = sequelize.define('User' + Math.random(), {
          name: {
            type: Sequelize.STRING,
            validate: {
              customFn: function(val) {
                if (val !== "2")
                  throw new Error("name should equal '2'")
              }
            }
          }
        });

        var u_fail = User.build({
          name : "3"
        });
        var errors = u_fail.validate();
        expect(errors).toNotBe(null);
        expect(errors).toEqual({
          name : ["name should equal '2'"]
        });

        var u_success = User.build({
          name : "2"
        });
        expect(u_success.validate()).toBe(null);

        done();
      });
    });
  })
})
