'use strict';

const chai = require('chai'),
  Sequelize = require('sequelize'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('attributes', () => {
    describe('types', () => {
      describe('VIRTUAL', () => {
        beforeEach(async function() {
          this.User = this.sequelize.define('user', {
            storage: Sequelize.STRING,
            field1: {
              type: Sequelize.VIRTUAL,
              set(val) {
                this.setDataValue('storage', val);
                this.setDataValue('field1', val);
              },
              get() {
                return this.getDataValue('field1');
              }
            },
            field2: {
              type: Sequelize.VIRTUAL,
              get() {
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
          this.User.hasMany(this.Task);
          this.Project.belongsToMany(this.User, { through: 'project_user' });
          this.User.belongsToMany(this.Project, { through: 'project_user' });

          this.sqlAssert = function(sql) {
            expect(sql).to.not.include('field1');
            expect(sql).to.not.include('field2');
          };

          await this.sequelize.sync({ force: true });
        });

        it('should not be ignored in dataValues get', function() {
          const user = this.User.build({
            field1: 'field1_value',
            field2: 'field2_value'
          });

          expect(user.get()).to.deep.equal({ storage: 'field1_value', field1: 'field1_value', virtualWithDefault: 'cake', field2: 42, id: null });
        });

        it('should be ignored in table creation', async function() {
          const fields = await this.sequelize.getQueryInterface().describeTable(this.User.tableName);
          expect(Object.keys(fields).length).to.equal(2);
        });

        it('should be ignored in find, findAll and includes', async function() {
          await Promise.all([
            this.User.findOne({
              logging: this.sqlAssert
            }),
            this.User.findAll({
              logging: this.sqlAssert
            }),
            this.Task.findAll({
              include: [
                this.User
              ],
              logging: this.sqlAssert
            }),
            this.Project.findAll({
              include: [
                this.User
              ],
              logging: this.sqlAssert
            })
          ]);
        });

        it('should allow me to store selected values', async function() {
          const Post = this.sequelize.define('Post', {
            text: Sequelize.TEXT,
            someBoolean: {
              type: Sequelize.VIRTUAL
            }
          });

          await this.sequelize.sync({ force: true });
          await Post.bulkCreate([{ text: 'text1' }, { text: 'text2' }]);
          let boolQuery = 'EXISTS(SELECT 1) AS "someBoolean"';
          if (dialect === 'mssql') {
            boolQuery = 'CAST(CASE WHEN EXISTS(SELECT 1) THEN 1 ELSE 0 END AS BIT) AS "someBoolean"';
          } else if (dialect === 'db2') {
            boolQuery = '1 AS "someBoolean"';
          } else if (dialect === 'oracle') {
            boolQuery = '(CASE WHEN EXISTS(SELECT 1 FROM DUAL) THEN 1 ELSE 0 END) AS "someBoolean"';
          }

          const post = await Post.findOne({ attributes: ['id', 'text', Sequelize.literal(boolQuery)] });
          expect(post.get('someBoolean')).to.be.ok;
          expect(post.get().someBoolean).to.be.ok;
        });

        it('should be ignored in create and update', async function() {
          const user0 = await this.User.create({
            field1: 'something'
          });

          // We already verified that the virtual is not added to the table definition,
          // so if this succeeds, were good

          expect(user0.virtualWithDefault).to.equal('cake');
          expect(user0.storage).to.equal('something');

          const user = await user0.update({
            field1: 'something else'
          }, {
            fields: ['storage']
          });

          expect(user.virtualWithDefault).to.equal('cake');
          expect(user.storage).to.equal('something else');
        });

        it('should be ignored in bulkCreate and and bulkUpdate', async function() {
          await this.User.bulkCreate([{
            field1: 'something'
          }], {
            logging: this.sqlAssert
          });

          const users = await this.User.findAll();
          expect(users[0].storage).to.equal('something');
        });

        it('should be able to exclude with attributes', async function() {
          await this.User.bulkCreate([{
            field1: 'something'
          }], {
            logging: this.sqlAssert
          });

          const users0 = await this.User.findAll({
            logging: this.sqlAssert
          });

          const user0 = users0[0].get();

          expect(user0.storage).to.equal('something');
          expect(user0).to.include.all.keys(['field1', 'field2']);

          const users = await this.User.findAll({
            attributes: {
              exclude: ['field1']
            },
            logging: this.sqlAssert
          });

          const user = users[0].get();

          expect(user.storage).to.equal('something');
          expect(user).not.to.include.all.keys(['field1']);
          expect(user).to.include.all.keys(['field2']);
        });

        it('should be able to include model with virtual attributes', async function() {
          const user0 = await this.User.create(dialect === 'db2' ? { id: 1 } : {});
          await user0.createTask();

          const tasks = await this.Task.findAll({
            include: [{
              attributes: ['field2', 'id'],
              model: this.User
            }]
          });

          const user = tasks[0].user.get();

          expect(user.field2).to.equal(42);
        });
      });
    });
  });
});
