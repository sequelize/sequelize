"use strict";

/* jshint camelcase: false */
/* jshint expr: true */
var chai      = require('chai')
  , Sequelize = require('../../index')
  , Promise   = Sequelize.Promise
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , dialect   = Support.getTestDialect()
  , datetime  = require('chai-datetime');

chai.use(datetime);
chai.config.includeStack = true;

describe(Support.getTestDialectTeaser("Model"), function () {
  describe('attributes', function () {
    describe('types', function () {
      describe('VIRTUAL', function () {
        beforeEach(function () {
          this.User = this.sequelize.define('user', {
            storage: Sequelize.STRING,
            field1: {
              type: Sequelize.VIRTUAL,
              set: function (val) {
                this.setDataValue('storage', val);
                this.setDataValue('field1', val);
              },
              get: function () {
                return this.getDataValue('field1');
              }
            },
            field2: {
              type: Sequelize.VIRTUAL,
              get: function () {
                return 42;
              }
            },
            virtualWithDefault: {
              type: Sequelize.VIRTUAL,
              defaultValue: 'cake'
            }
          }, { timestamps: false });

          this.Task = this.sequelize.define('task', {});
          this.Project = this.sequelize.define('project', {});

          this.Task.belongsTo(this.User);
          this.Project.hasMany(this.User);
          this.User.hasMany(this.Project);

          this.sqlAssert = function(sql) {
            expect(sql.indexOf('field1')).to.equal(-1);
            expect(sql.indexOf('field2')).to.equal(-1);
          };

          return this.sequelize.sync({ force: true });
        });

        it('should not be ignored in dataValues get', function () {
          var user = this.User.build({
            field1: 'field1_value',
            field2: 'field2_value'
          });

          expect(user.get()).to.deep.equal({ storage: 'field1_value', field1: 'field1_value', virtualWithDefault: 'cake', field2: 42, id: null });
        });

        it('should be ignored in table creation', function () {
          return this.sequelize.getQueryInterface().describeTable(this.User.tableName).then(function (fields) {
            expect(Object.keys(fields).length).to.equal(2);
          });
        });

        it('should be ignored in find, findAll and includes', function () {
          return Promise.all([
            this.User.find().on('sql', this.sqlAssert),
            this.User.findAll().on('sql', this.sqlAssert),
            this.Task.findAll({
              include: [
                this.User
              ]
            }).on('sql', this.sqlAssert),
            this.Project.findAll({
              include: [
                this.User
              ]
            }).on('sql', this.sqlAssert)
          ]);
        });

        it("should allow me to store selected values", function () {
          var Post = this.sequelize.define('Post', {
              text: Sequelize.TEXT,
              someBoolean: {
                type: Sequelize.VIRTUAL
              }
            });

          return this.sequelize.sync({ force: true}).then(function () {
            return Post.bulkCreate([{ text: 'text1' },{ text: 'text2' }]);
          }).then(function () {
            return Post.find({ attributes: ['id','text',Sequelize.literal('EXISTS(SELECT 1) AS "someBoolean"')] });
          }).then(function (post) {
            expect(post.get('someBoolean')).to.be.ok;
            expect(post.get().someBoolean).to.be.ok;
          });
        });

        it('should be ignored in create and updateAttributes', function () {
          return this.User.create({
            field1: 'something'
          }).then(function (user) {
            // We already verified that the virtual is not added to the table definition, so if this succeeds, were good

            expect(user.virtualWithDefault).to.equal('cake');
            expect(user.storage).to.equal('something');
            return user.updateAttributes({
              field1: 'something else'
            });
          }).then(function (user) {
            expect(user.virtualWithDefault).to.equal('cake');
            expect(user.storage).to.equal('something else');
          });
        });

        it('should be ignored in bulkCreate and and bulkUpdate', function () {
          var self = this;
          return this.User.bulkCreate([{
            field1: 'something'
          }]).on('sql', this.sqlAssert).then(function () {
            return self.User.findAll();
          }).then(function (users) {
            expect(users[0].storage).to.equal('something');
          });
        });
      });
    });

    describe('set', function () {
      it('should only be called once when used on a join model called with an association getter', function () {
        var self = this;
        self.callCount = 0;

        this.Student = this.sequelize.define('student', {
          no: {type:Sequelize.INTEGER, primaryKey:true},
          name: Sequelize.STRING,
        }, {
          tableName: "student",
          timestamps: false
        });

        this.Course = this.sequelize.define('course', {
          no: {type:Sequelize.INTEGER,primaryKey:true},
          name: Sequelize.STRING,
        },{
          tableName: 'course',
          timestamps: false
        });

        this.Score = this.sequelize.define('score',{
          score: Sequelize.INTEGER,
          test_value: {
            type: Sequelize.INTEGER,
            set: function(v) {
              self.callCount++;
              this.setDataValue('test_value', v+1);
            }
          }
        }, {
          tableName: 'score',
          timestamps: false
        });

        this.Student.hasMany(this.Course, {through: this.Score, foreignKey: 'StudentId'});
        this.Course.hasMany(this.Student, {through: this.Score, foreignKey: 'CourseId'});

        return this.sequelize.sync({force:true}).then(function () {
          return Promise.join(
            self.Student.create({no:1, name:'ryan'}),
            self.Course.create({no:100, name:'history'})
          ).spread(function(student, course){
            return student.addCourse(course, {score: 98, test_value: 1000});
          }).then(function(){
            expect(self.callCount).to.equal(1);
            return self.Score.find({StudentId: 1, CourseId: 100}).then(function(score){
              expect(score.test_value).to.equal(1001);
            });
          })
          .then(function(){
            return Promise.join(
              self.Student.build({no: 1}).getCourses({where: {no: 100}}),
              self.Score.find({StudentId: 1, CourseId:100})
            );
          })
          .spread(function(courses, score) {
            expect(score.test_value).to.equal(1001);
            expect(courses[0].score.toJSON().test_value).to.equal(1001);
            expect(self.callCount).to.equal(1);
          });
        });
      });
    });
  });
});
