'use strict';

/* jshint -W030 */
var chai = require('chai')
  , Sequelize = require('../../../../index')
  , Promise = Sequelize.Promise
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , dialect = Support.getTestDialect();

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('attributes', function() {
    describe('types', function() {
      describe('VIRTUAL', function() {
        beforeEach(function() {
          this.User = this.sequelize.define('user', {
            storage: Sequelize.STRING,
            field1: {
              type: Sequelize.VIRTUAL,
              set: function(val) {
                this.setDataValue('storage', val);
                this.setDataValue('field1', val);
              },
              get: function() {
                return this.getDataValue('field1');
              }
            },
            field2: {
              type: Sequelize.VIRTUAL,
              get: function() {
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

        it('should not be ignored in dataValues get', function() {
          var user = this.User.build({
            field1: 'field1_value',
            field2: 'field2_value'
          });

          expect(user.get()).to.deep.equal({ storage: 'field1_value', field1: 'field1_value', virtualWithDefault: 'cake', field2: 42, id: null });
        });

        it('should be ignored in table creation', function() {
          return this.sequelize.getQueryInterface().describeTable(this.User.tableName).then(function(fields) {
            expect(Object.keys(fields).length).to.equal(2);
          });
        });

        it('should be ignored in find, findAll and includes', function() {
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

        it('should allow me to store selected values', function() {
          var Post = this.sequelize.define('Post', {
              text: Sequelize.TEXT,
              someBoolean: {
                type: Sequelize.VIRTUAL
              }
            });

          return this.sequelize.sync({ force: true}).then(function() {
            return Post.bulkCreate([{ text: 'text1' },{ text: 'text2' }]);
          }).then(function() {
            var boolQuery = 'EXISTS(SELECT 1) AS "someBoolean"';
            if (dialect === 'mssql') {
              boolQuery = 'CAST(CASE WHEN EXISTS(SELECT 1) THEN 1 ELSE 0 END AS BIT) AS "someBoolean"';
            }

            return Post.find({ attributes: ['id', 'text', Sequelize.literal(boolQuery)] });
          }).then(function(post) {
            expect(post.get('someBoolean')).to.be.ok;
            expect(post.get().someBoolean).to.be.ok;
          });
        });

        it('should be ignored in create and updateAttributes', function() {
          return this.User.create({
            field1: 'something'
          }).then(function(user) {
            // We already verified that the virtual is not added to the table definition, so if this succeeds, were good

            expect(user.virtualWithDefault).to.equal('cake');
            expect(user.storage).to.equal('something');
            return user.updateAttributes({
              field1: 'something else'
            }, {
              fields: ['storage']
            });
          }).then(function(user) {
            expect(user.virtualWithDefault).to.equal('cake');
            expect(user.storage).to.equal('something else');
          });
        });

        it('should be ignored in bulkCreate and and bulkUpdate', function() {
          var self = this;
          return this.User.bulkCreate([{
            field1: 'something'
          }]).on('sql', this.sqlAssert).then(function() {
            return self.User.findAll();
          }).then(function(users) {
            expect(users[0].storage).to.equal('something');
          });
        });
      });
    });
  });
});
