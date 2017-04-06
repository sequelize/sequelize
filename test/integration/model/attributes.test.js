'use strict';

const chai = require('chai'),
  Sequelize = require('../../../index'),
  Promise = Sequelize.Promise,
  expect = chai.expect,
  Support = require(__dirname + '/../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('attributes', () => {
    describe('set', () => {
      it('should only be called once when used on a join model called with an association getter', function() {
        const self = this;
        self.callCount = 0;

        this.Student = this.sequelize.define('student', {
          no: {type: Sequelize.INTEGER, primaryKey: true},
          name: Sequelize.STRING
        }, {
          tableName: 'student',
          timestamps: false
        });

        this.Course = this.sequelize.define('course', {
          no: {type: Sequelize.INTEGER, primaryKey: true},
          name: Sequelize.STRING
        }, {
          tableName: 'course',
          timestamps: false
        });

        this.Score = this.sequelize.define('score', {
          score: Sequelize.INTEGER,
          test_value: {
            type: Sequelize.INTEGER,
            set(v) {
              self.callCount++;
              this.setDataValue('test_value', v + 1);
            }
          }
        }, {
          tableName: 'score',
          timestamps: false
        });

        this.Student.belongsToMany(this.Course, {through: this.Score, foreignKey: 'StudentId'});
        this.Course.belongsToMany(this.Student, {through: this.Score, foreignKey: 'CourseId'});

        return this.sequelize.sync({force: true}).then(() => {
          return Promise.join(
            self.Student.create({no: 1, name: 'ryan'}),
            self.Course.create({no: 100, name: 'history'})
          ).spread((student, course) => {
            return student.addCourse(course, { through: {score: 98, test_value: 1000}});
          }).then(() => {
            expect(self.callCount).to.equal(1);
            return self.Score.find({ where: { StudentId: 1, CourseId: 100 } }).then((score) => {
              expect(score.test_value).to.equal(1001);
            });
          })
          .then(() => {
            return Promise.join(
              self.Student.build({no: 1}).getCourses({where: {no: 100}}),
              self.Score.find({ where: { StudentId: 1, CourseId: 100 } })
            );
          })
          .spread((courses, score) => {
            expect(score.test_value).to.equal(1001);
            expect(courses[0].score.toJSON().test_value).to.equal(1001);
            expect(self.callCount).to.equal(1);
          });
        });
      });
    });
  });
});
