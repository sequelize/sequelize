'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , expect = chai.expect
  , Sequelize = require('../../index')
  , Support = require(__dirname + '/support');

chai.should();

describe(Support.getTestDialectTeaser('Vectors'), function() {
  it('should not allow insert backslash', function () {
    var Student = this.sequelize.define('student', {
      name: Sequelize.STRING
    }, {
      tableName: 'student'
    });

    return Student.sync({force: true}).then(function () {
      return Student.create({
        name: 'Robert\\\'); DROP TABLE "students"; --'
      }, {
        logging: console.log
      }).then(function(result) {
        expect(result.get('name')).to.equal('Robert\\\'); DROP TABLE "students"; --');
        return Student.findAll();
      }).then(function(result) {
        expect(result[0].name).to.equal('Robert\\\'); DROP TABLE "students"; --');
      });
    });
  });
});