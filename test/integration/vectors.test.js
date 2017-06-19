'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Sequelize = require('../../index'),
  Support = require(__dirname + '/support');

chai.should();

describe(Support.getTestDialectTeaser('Vectors'), () => {
  it('should not allow insert backslash', function() {
    const Student = this.sequelize.define('student', {
      name: Sequelize.STRING
    }, {
      tableName: 'student'
    });

    return Student.sync({force: true}).then(() => {
      return Student.create({
        name: 'Robert\\\'); DROP TABLE "students"; --'
      }).then(result => {
        expect(result.get('name')).to.equal('Robert\\\'); DROP TABLE "students"; --');
        return Student.findAll();
      }).then(result => {
        expect(result[0].name).to.equal('Robert\\\'); DROP TABLE "students"; --');
      });
    });
  });
});
