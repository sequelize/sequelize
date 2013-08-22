/* jshint camelcase: false */
var chai      = require('chai')
  , Sequelize = require('../index')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , DataTypes = require(__dirname + "/../lib/data-types")
  , dialect   = Support.getTestDialect()
  , config    = require(__dirname + "/config/config")
  , sinon     = require('sinon')
  , datetime  = require('chai-datetime')
  , _         = require('lodash')
  , moment    = require('moment')

chai.use(datetime)
chai.Assertion.includeStack = true

describe.skip(Support.getTestDialectTeaser("DAOFactory Hooks"), function () {
  beforeEach(function(done) {
    this.User = this.sequelize.define('User', {
      username:     DataTypes.STRING,
      secretValue: {
        type: DataTypes.STRING,
        validate: {
          isInt: {args: true, msg: 'secretValue must be an integer'}
        }
      },
      data:         DataTypes.STRING,
      intVal:       DataTypes.INTEGER,
      theDate:      DataTypes.DATE
    })
    this.User.sync({ force: true }).success(function() {
      done()
    })
  })

  describe('#beforeValidation', function() {
    it('should emit a beforeValidation event when we explicitly call .validate()', function(done) {
      var User = this.sequelize.define('User', {
        username:   DataTypes.STRING,
        secretValue: {
          type: DataTypes.STRING,
          validate: {
            isInt: {args: true, msg: 'secretValue must be an integer'}
          }
        }
      })

      User.sync({ force: true }).success(function() {
        User.on('beforeValidation', function(values, next) {
          console.log('ARGS', values, next)
          console.log('FROM WITHIN', this)
          values.secretValue = '42' // muahaha
          values.listener(null, {hello: 'world'})
        })

        User.on('beforeValidation', function(next) {
          this.secretValue = 10;
          next(null, this)
        })

        var user = User.build({username: 'Tobi', secretValue: 42})
          , flag = _.after(1, function() {
            done()
          })

        var validate = user.validate()
        console.log(validate)
        done()
      })
    })
  })
})
