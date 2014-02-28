/* jshint camelcase: false */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , Sequelize = Support.Sequelize
  // , sinon     = require('sinon')

chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("Sequelize Errors"), function () {
  describe('API Surface', function() {
    it('Should have the Error constructors exposed', function() {
      expect(Sequelize).to.have.property('Error')
      expect(Sequelize).to.have.property('ValidationError')
      var sequelize = new Sequelize();
      expect(sequelize).to.have.property('Error')
      expect(sequelize).to.have.property('ValidationError')
    })
    it('Sequelize Errors instances should be instances of Error', function() {
      var error = new Sequelize.Error();
      var validationError = new Sequelize.ValidationError();


      var sequelize = new Sequelize();
      var instError = new sequelize.Error();
      var instValidationError = new sequelize.ValidationError();

      expect(error).to.be.instanceOf(Error)
      expect(validationError).to.be.instanceOf(Error)
      expect(instError).to.be.instanceOf(Error)
      expect(instValidationError).to.be.instanceOf(Error)
    })
  })
})
