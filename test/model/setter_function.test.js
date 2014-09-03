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
    describe('setter function in join table', function () {
        beforeEach(function () {
            this.Student = this.sequelize.define('student', {
                no: {type:Sequelize.INTEGER, primaryKey:true},
                name: Sequelize.STRING,
            },{
                tableName: "student",
                timestamps: false
            })

            this.Course = this.sequelize.define('course', {
                no: {type:Sequelize.INTEGER,primaryKey:true},
                name: Sequelize.STRING,
            },{
                tableName: 'course',
                timestamps: false
            })

            var self = this
            self.setter_function_called_count = 0
            this.Score = this.sequelize.define('score',{
                score: Sequelize.INTEGER,
                test_value: {
                    type: Sequelize.INTEGER,
                    set: function(v) {
                        self.setter_function_called_count++;
                        this.setDataValue('test_value',v+1)
                    },
                    //get: function() {
                        //return Number(this.getDataValue('test_value'))
                    //}
                }
            },{
                tableName: 'score',
                timestamps: false
            })

            this.Student.hasMany(this.Course, {through:this.Score,foreignKey:'StudentId'})
            this.Course.hasMany(this.Student,{through:this.Score,foreignKey:'CourseId'})

            return this.sequelize.sync({force:true})
        });

        it('create some data and test', function () {
            var self = this;

            return Promise.all([
                this.Student.create({no:1,name:'ryan'}),
                this.Course.create({no:100,name:'history'}),
            ])
            .bind(this).then(function(){
                var s = this.Student.build({no:1})
                var c = this.Course.build({no:100})
                return s.addCourse(c,{score:98,test_value:1000})
            })
            .then(function(){
                expect(self.setter_function_called_count).to.equal(1)
                return self.Score.find({StudentId:1,CourseId:100}).then(function(s){
                    expect(s.test_value).to.equal(1001)  // setter function increased test_value
                })
            })
            .then(function(){
                return this.Student.build({no:1}).getCourses({where:{no:100}})
                .then(function(m){
                    // data in database is ok
                    return self.Score.find({StudentId:1,CourseId:100}).then(function(s){
                        expect(s.test_value).to.equal(1001)
                        return m
                    })
                })
            })
            .then(function(m){
                // either is failed. because setter function is called twice.
                expect(m[0].score.toJSON().test_value).to.equal(1001)
                expect(self.setter_function_called_count).to.equal(1)
            })
        });

    });
});
