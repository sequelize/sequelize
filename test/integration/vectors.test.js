'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Sequelize = require('sequelize'),
  Support = require('./support');

chai.should();

describe(Support.getTestDialectTeaser('Vectors'), () => {
  it('should not allow insert backslash', async function() {
    const Student = this.sequelize.define('student', {
      name: Sequelize.STRING
    }, {
      tableName: 'student'
    });

    await Student.sync({ force: true });

    const result0 = await Student.create({
      name: 'Robert\\\'); DROP TABLE "students"; --'
    });

    expect(result0.get('name')).to.equal('Robert\\\'); DROP TABLE "students"; --');
    const result = await Student.findAll();
    expect(result[0].name).to.equal('Robert\\\'); DROP TABLE "students"; --');
  });
});
