/* jshint camelcase: false */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , Sequelize = Support.Sequelize;

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser("Sequelize Errors"), function () {
  describe('API Surface', function() {
    it('Should have the Error constructors exposed', function() {
      expect(Sequelize).to.have.property('Error');
      expect(Sequelize).to.have.property('ValidationError');
      var sequelize = new Sequelize();
      expect(sequelize).to.have.property('Error');
      expect(sequelize).to.have.property('ValidationError');
    });
    it('Sequelize Errors instances should be instances of Error', function() {
      var error = new Sequelize.Error();
      var validationError = new Sequelize.ValidationError();


      var sequelize = new Sequelize();
      var instError = new sequelize.Error();
      var instValidationError = new sequelize.ValidationError();

      expect(error).to.be.instanceOf(Sequelize.Error);
      expect(error).to.have.property('name', 'SequelizeBaseError');
      expect(validationError).to.be.instanceOf(Sequelize.ValidationError);
      expect(validationError).to.have.property('name', 'SequelizeValidationError');
      expect(instError).to.be.instanceOf(Sequelize.Error);
      expect(instValidationError).to.be.instanceOf(Sequelize.ValidationError);
    });
    it('SequelizeValidationError should find errors by path', function() {
      var errorItems = [
        new Sequelize.ValidationErrorItem('invalid', 'type', 'first_name', null),
        new Sequelize.ValidationErrorItem('invalid', 'type', 'last_name', null)
      ];
      var validationError = new Sequelize.ValidationError('Validation error', errorItems);
      expect(validationError).to.have.property('errorsForPath');
      expect(validationError.errorsForPath).to.be.a('function');

      var matches = validationError.errorsForPath('first_name');
      expect(matches).to.be.instanceOf(Array);
      expect(matches).to.have.lengthOf(1);
      expect(matches[0]).to.have.property('message', 'invalid')
    });
  })
});
