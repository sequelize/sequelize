'use strict';

const chai = require('chai');
const { DataTypes } = require('@sequelize/core');

const expect = chai.expect;
const Support = require('../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('attributes', () => {
    describe('set', () => {
      it('should only be called once when used on a join model called with an association getter', async function () {
        let callCount = 0;

        this.Student = this.sequelize.define('student', {
          no: { type: DataTypes.INTEGER, primaryKey: true },
          name: DataTypes.STRING,
        }, {
          tableName: 'student',
          timestamps: false,
        });

        this.Course = this.sequelize.define('course', {
          no: { type: DataTypes.INTEGER, primaryKey: true },
          name: DataTypes.STRING,
        }, {
          tableName: 'course',
          timestamps: false,
        });

        this.Score = this.sequelize.define('score', {
          score: DataTypes.INTEGER,
          test_value: {
            type: DataTypes.INTEGER,
            set(v) {
              callCount++;
              this.setDataValue('test_value', v + 1);
            },
          },
        }, {
          tableName: 'score',
          timestamps: false,
        });

        this.Student.belongsToMany(this.Course, { through: this.Score, foreignKey: 'StudentId', otherKey: 'CourseId' });

        await this.sequelize.sync({ force: true });

        const [student, course] = await Promise.all([
          this.Student.create({ no: 1, name: 'ryan' }),
          this.Course.create({ no: 100, name: 'history' }),
        ]);

        await student.addCourse(course, { through: { score: 98, test_value: 1000 } });
        expect(callCount).to.equal(1);
        const score0 = await this.Score.findOne({ where: { StudentId: 1, CourseId: 100 } });
        expect(score0.test_value).to.equal(1001);

        const [courses, score] = await Promise.all([
          this.Student.build({ no: 1 }).getCourses({ where: { no: 100 } }),
          this.Score.findOne({ where: { StudentId: 1, CourseId: 100 } }),
        ]);

        expect(score.test_value).to.equal(1001);
        expect(courses[0].studentCourse.toJSON().test_value).to.equal(1001);
        expect(callCount).to.equal(1);
      });

      it('allows for an attribute to be called "toString"', async function () {
        const Person = this.sequelize.define('person', {
          name: DataTypes.STRING,
          nick: DataTypes.STRING,
        }, {
          timestamps: false,
        });

        await this.sequelize.sync({ force: true });
        await Person.create({ name: 'Jozef', nick: 'Joe' });

        const person = await Person.findOne({
          attributes: [
            'nick',
            ['name', 'toString'],
          ],
          where: {
            name: 'Jozef',
          },
        });

        expect(person.dataValues.toString).to.equal('Jozef');
        expect(person.get('toString')).to.equal('Jozef');
      });

      it('allows for an attribute to be called "toString" with associations', async function () {
        const Person = this.sequelize.define('person', {
          name: DataTypes.STRING,
          nick: DataTypes.STRING,
        });

        const Computer = this.sequelize.define('computer', {
          hostname: DataTypes.STRING,
        });

        Person.hasMany(Computer);

        await this.sequelize.sync({ force: true });
        const person = await Person.create({ name: 'Jozef', nick: 'Joe' });
        await person.createComputer({ hostname: 'laptop' });

        const result = await Person.findAll({
          attributes: [
            'nick',
            ['name', 'toString'],
          ],
          include: {
            model: Computer,
          },
          where: {
            name: 'Jozef',
          },
        });

        expect(result.length).to.equal(1);
        expect(result[0].dataValues.toString).to.equal('Jozef');
        expect(result[0].get('toString')).to.equal('Jozef');
        expect(result[0].get('computers')[0].hostname).to.equal('laptop');
      });
    });
  });
});
