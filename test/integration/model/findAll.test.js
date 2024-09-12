'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  Sequelize = require('sequelize'),
  expect = chai.expect,
  Support = require('../support'),
  Op = Sequelize.Op,
  DataTypes = require('sequelize/lib/data-types'),
  dialect = Support.getTestDialect(),
  _ = require('lodash'),
  moment = require('moment'),
  current = Support.sequelize,
  promiseProps = require('p-props');

describe(Support.getTestDialectTeaser('Model'), () => {
  beforeEach(async function() {
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      secretValue: DataTypes.STRING,
      data: DataTypes.STRING,
      intVal: DataTypes.INTEGER,
      theDate: DataTypes.DATE,
      aBool: DataTypes.BOOLEAN,
      binary: DataTypes.STRING(16, true)
    });

    await this.User.sync({ force: true });
  });

  describe('findAll', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', async function() {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: Sequelize.STRING });

        await User.sync({ force: true });
        const t = await sequelize.transaction();
        await User.create({ username: 'foo' }, { transaction: t });
        const users1 = await User.findAll({ where: { username: 'foo' } });
        const users2 = await User.findAll({ transaction: t });
        const users3 = await User.findAll({ where: { username: 'foo' }, transaction: t });
        expect(users1.length).to.equal(0);
        expect(users2.length).to.equal(1);
        expect(users3.length).to.equal(1);
        await t.rollback();
      });
    }

    it('should not crash on an empty where array', async function() {
      await this.User.findAll({
        where: []
      });
    });

    it('should throw on an attempt to fetch no attributes', async function() {
      await expect(this.User.findAll({ attributes: [] })).to.be.rejectedWith(
        Sequelize.QueryError,
        /^Attempted a SELECT query.+without selecting any columns$/
      );
    });

    it('should not throw if overall attributes are nonempty', async function() {
      const Post = this.sequelize.define('Post', { foo: DataTypes.STRING });
      const Comment = this.sequelize.define('Comment', { bar: DataTypes.STRING });
      Post.hasMany(Comment, { as: 'comments' });
      await Post.sync({ force: true });
      await Comment.sync({ force: true });

      // Should not throw in this case, even
      // though `attributes: []` is set for the main model
      await Post.findAll({
        raw: true,
        attributes: [],
        include: [
          {
            model: Comment,
            as: 'comments',
            attributes: [
              [Sequelize.fn('COUNT', Sequelize.col('comments.id')), 'commentCount']
            ]
          }
        ]
      });
    });

    describe('special where conditions/smartWhere object', () => {
      beforeEach(async function() {
        this.buf = Buffer.alloc(16);
        this.buf.fill('\x01');

        await this.User.bulkCreate([
          { username: 'boo', intVal: 5, theDate: '2013-01-01 12:00' },
          { username: 'boo2', intVal: 10, theDate: '2013-01-10 12:00', binary: this.buf }
        ]);
      });

      it('should be able to find rows where attribute is in a list of values', async function() {
        const users = await this.User.findAll({
          where: {
            username: ['boo', 'boo2']
          }
        });

        expect(users).to.have.length(2);
      });

      it('should not break when trying to find rows using an array of primary keys', async function() {
        await this.User.findAll({
          where: {
            id: [1, 2, 3]
          }
        });
      });

      it('should not break when using smart syntax on binary fields', async function() {
        const users = await this.User.findAll({
          where: {
            binary: [this.buf, this.buf]
          }
        });

        expect(users).to.have.length(1);
        expect(users[0].binary.toString()).to.equal(this.buf.toString());
        expect(users[0].username).to.equal('boo2');
      });

      it('should be able to find a row using like', async function() {
        const users = await this.User.findAll({
          where: {
            username: {
              [Op.like]: '%2'
            }
          }
        });

        expect(users).to.be.an.instanceof(Array);
        expect(users).to.have.length(1);
        expect(users[0].username).to.equal('boo2');
        expect(users[0].intVal).to.equal(10);
      });

      it('should be able to find a row using not like', async function() {
        const users = await this.User.findAll({
          where: {
            username: {
              [Op.notLike]: '%2'
            }
          }
        });

        expect(users).to.be.an.instanceof(Array);
        expect(users).to.have.length(1);
        expect(users[0].username).to.equal('boo');
        expect(users[0].intVal).to.equal(5);
      });

      if (dialect === 'postgres') {
        it('should be able to find a row using ilike', async function() {
          const users = await this.User.findAll({
            where: {
              username: {
                [Op.iLike]: '%2'
              }
            }
          });

          expect(users).to.be.an.instanceof(Array);
          expect(users).to.have.length(1);
          expect(users[0].username).to.equal('boo2');
          expect(users[0].intVal).to.equal(10);
        });

        it('should be able to find a row using not ilike', async function() {
          const users = await this.User.findAll({
            where: {
              username: {
                [Op.notILike]: '%2'
              }
            }
          });

          expect(users).to.be.an.instanceof(Array);
          expect(users).to.have.length(1);
          expect(users[0].username).to.equal('boo');
          expect(users[0].intVal).to.equal(5);
        });
      }

      it('should be able to find a row between a certain date using the between shortcut', async function() {
        const users = await this.User.findAll({
          where: {
            theDate: {
              [Op.between]: ['2013-01-02', '2013-01-11']
            }
          }
        });

        expect(users[0].username).to.equal('boo2');
        expect(users[0].intVal).to.equal(10);
      });

      it('should be able to find a row not between a certain integer using the not between shortcut', async function() {
        const users = await this.User.findAll({
          where: {
            intVal: {
              [Op.notBetween]: [8, 10]
            }
          }
        });

        expect(users[0].username).to.equal('boo');
        expect(users[0].intVal).to.equal(5);
      });

      it('should be able to handle false/true values just fine...', async function() {
        const User = this.User;

        await User.bulkCreate([
          { username: 'boo5', aBool: false },
          { username: 'boo6', aBool: true }
        ]);

        const users = await User.findAll({ where: { aBool: false } });
        expect(users).to.have.length(1);
        expect(users[0].username).to.equal('boo5');
        const _users = await User.findAll({ where: { aBool: true } });
        expect(_users).to.have.length(1);
        expect(_users[0].username).to.equal('boo6');
      });

      it('should be able to handle false/true values through associations as well...', async function() {
        const User = this.User,
          Passports = this.sequelize.define('Passports', {
            isActive: Sequelize.BOOLEAN
          });

        User.hasMany(Passports);
        Passports.belongsTo(User);

        await User.sync({ force: true });
        await Passports.sync({ force: true });

        await User.bulkCreate([
          { username: 'boo5', aBool: false },
          { username: 'boo6', aBool: true }
        ]);

        await Passports.bulkCreate([
          { isActive: true },
          { isActive: false }
        ]);

        const user = await User.findByPk(1);
        const passport = await Passports.findByPk(1);
        await user.setPassports([passport]);
        const _user = await User.findByPk(2);
        const _passport = await Passports.findByPk(2);
        await _user.setPassports([_passport]);
        const theFalsePassport = await _user.getPassports({ where: { isActive: false } });
        const theTruePassport = await user.getPassports({ where: { isActive: true } });
        expect(theFalsePassport).to.have.length(1);
        expect(theFalsePassport[0].isActive).to.be.false;
        expect(theTruePassport).to.have.length(1);
        expect(theTruePassport[0].isActive).to.be.true;
      });

      it('should be able to handle binary values through associations as well...', async function() {
        const User = this.User;
        const Binary = this.sequelize.define('Binary', {
          id: {
            type: DataTypes.STRING(16, true),
            primaryKey: true
          }
        });

        const buf1 = this.buf;
        const buf2 = Buffer.alloc(16);
        buf2.fill('\x02');

        User.belongsTo(Binary, { foreignKey: 'binary' });

        await this.sequelize.sync({ force: true });

        await User.bulkCreate([
          { username: 'boo5', aBool: false },
          { username: 'boo6', aBool: true }
        ]);

        await Binary.bulkCreate([
          { id: buf1 },
          { id: buf2 }
        ]);

        const user = await User.findByPk(1);
        const binary = await Binary.findByPk(buf1);
        await user.setBinary(binary);
        const _user = await User.findByPk(2);
        const _binary = await Binary.findByPk(buf2);
        await _user.setBinary(_binary);
        const _binaryRetrieved = await _user.getBinary();
        const binaryRetrieved = await user.getBinary();
        expect(binaryRetrieved.id).to.have.length(16);
        expect(_binaryRetrieved.id).to.have.length(16);
        expect(binaryRetrieved.id.toString()).to.be.equal(buf1.toString());
        expect(_binaryRetrieved.id.toString()).to.be.equal(buf2.toString());
      });

      it('should be able to find a row between a certain date', async function() {
        const users = await this.User.findAll({
          where: {
            theDate: {
              [Op.between]: ['2013-01-02', '2013-01-11']
            }
          }
        });

        expect(users[0].username).to.equal('boo2');
        expect(users[0].intVal).to.equal(10);
      });

      it('should be able to find a row between a certain date and an additional where clause', async function() {
        const users = await this.User.findAll({
          where: {
            theDate: {
              [Op.between]: ['2013-01-02', '2013-01-11']
            },
            intVal: 10
          }
        });

        expect(users[0].username).to.equal('boo2');
        expect(users[0].intVal).to.equal(10);
      });

      it('should be able to find a row not between a certain integer', async function() {
        const users = await this.User.findAll({
          where: {
            intVal: {
              [Op.notBetween]: [8, 10]
            }
          }
        });

        expect(users[0].username).to.equal('boo');
        expect(users[0].intVal).to.equal(5);
      });

      it('should be able to find a row using not between and between logic', async function() {
        const users = await this.User.findAll({
          where: {
            theDate: {
              [Op.between]: ['2012-12-10', '2013-01-02'],
              [Op.notBetween]: ['2013-01-04', '2013-01-20']
            }
          }
        });

        expect(users[0].username).to.equal('boo');
        expect(users[0].intVal).to.equal(5);
      });

      it('should be able to find a row using not between and between logic with dates', async function() {
        const users = await this.User.findAll({
          where: {
            theDate: {
              [Op.between]: [new Date('2012-12-10'), new Date('2013-01-02')],
              [Op.notBetween]: [new Date('2013-01-04'), new Date('2013-01-20')]
            }
          }
        });

        expect(users[0].username).to.equal('boo');
        expect(users[0].intVal).to.equal(5);
      });

      it('should be able to find a row using greater than or equal to logic with dates', async function() {
        const users = await this.User.findAll({
          where: {
            theDate: {
              [Op.gte]: new Date('2013-01-09')
            }
          }
        });

        expect(users[0].username).to.equal('boo2');
        expect(users[0].intVal).to.equal(10);
      });

      it('should be able to find a row using greater than or equal to logic with moment dates', async function() {
        const users = await this.User.findAll({
          where: {
            theDate: {
              [Op.gte]: moment('2013-01-09')
            }
          }
        });

        expect(users[0].username).to.equal('boo2');
        expect(users[0].intVal).to.equal(10);
      });

      it('should be able to find a row using greater than or equal to', async function() {
        const user = await this.User.findOne({
          where: {
            intVal: {
              [Op.gte]: 6
            }
          }
        });

        expect(user.username).to.equal('boo2');
        expect(user.intVal).to.equal(10);
      });

      it('should be able to find a row using greater than', async function() {
        const user = await this.User.findOne({
          where: {
            intVal: {
              [Op.gt]: 5
            }
          }
        });

        expect(user.username).to.equal('boo2');
        expect(user.intVal).to.equal(10);
      });

      it('should be able to find a row using lesser than or equal to', async function() {
        const user = await this.User.findOne({
          where: {
            intVal: {
              [Op.lte]: 5
            }
          }
        });

        expect(user.username).to.equal('boo');
        expect(user.intVal).to.equal(5);
      });

      it('should be able to find a row using lesser than', async function() {
        const user = await this.User.findOne({
          where: {
            intVal: {
              [Op.lt]: 6
            }
          }
        });

        expect(user.username).to.equal('boo');
        expect(user.intVal).to.equal(5);
      });

      it('should have no problem finding a row using lesser and greater than', async function() {
        const users = await this.User.findAll({
          where: {
            intVal: {
              [Op.lt]: 6,
              [Op.gt]: 4
            }
          }
        });

        expect(users[0].username).to.equal('boo');
        expect(users[0].intVal).to.equal(5);
      });

      it('should be able to find a row using not equal to logic', async function() {
        const user = await this.User.findOne({
          where: {
            intVal: {
              [Op.ne]: 10
            }
          }
        });

        expect(user.username).to.equal('boo');
        expect(user.intVal).to.equal(5);
      });

      it('should be able to find multiple users with any of the special where logic properties', async function() {
        const users = await this.User.findAll({
          where: {
            intVal: {
              [Op.lte]: 10
            }
          }
        });

        expect(users[0].username).to.equal('boo');
        expect(users[0].intVal).to.equal(5);
        expect(users[1].username).to.equal('boo2');
        expect(users[1].intVal).to.equal(10);
      });

      if (['postgres', 'sqlite'].includes(dialect)) {
        it('should be able to find multiple users with case-insensitive on CITEXT type', async function() {
          const User = this.sequelize.define('UsersWithCaseInsensitiveName', {
            username: Sequelize.CITEXT
          });

          await User.sync({ force: true });

          await User.bulkCreate([
            { username: 'lowercase' },
            { username: 'UPPERCASE' },
            { username: 'MIXEDcase' }
          ]);

          const users = await User.findAll({
            where: { username: ['LOWERCASE', 'uppercase', 'mixedCase'] },
            order: [['id', 'ASC']]
          });

          expect(users[0].username).to.equal('lowercase');
          expect(users[1].username).to.equal('UPPERCASE');
          expect(users[2].username).to.equal('MIXEDcase');
        });
      }
    });

    describe('eager loading', () => {
      it('should not ignore where condition with empty includes, #8771', async function() {
        await this.User.bulkCreate([
          { username: 'D.E.N.N.I.S', intVal: 6 },
          { username: 'F.R.A.N.K', intVal: 5 },
          { username: 'W.I.L.D C.A.R.D', intVal: 8 }
        ]);

        const users = await this.User.findAll({
          where: {
            intVal: 8
          },
          include: []
        });

        expect(users).to.have.length(1);
        expect(users[0].get('username')).to.be.equal('W.I.L.D C.A.R.D');
      });

      describe('belongsTo', () => {
        beforeEach(async function() {
          this.Task = this.sequelize.define('TaskBelongsTo', { title: Sequelize.STRING });
          this.Worker = this.sequelize.define('Worker', { name: Sequelize.STRING });
          this.Task.belongsTo(this.Worker);

          await this.Worker.sync({ force: true });
          await this.Task.sync({ force: true });
          const worker = await this.Worker.create({ name: 'worker' });
          const task = await this.Task.create({ title: 'homework' });
          this.worker = worker;
          this.task = task;

          await this.task.setWorker(this.worker);
        });

        it('throws an error about unexpected input if include contains a non-object', async function() {
          try {
            await this.Worker.findAll({ include: [1] });
          } catch (err) {
            expect(err.message).to.equal('Include unexpected. Element has to be either a Model, an Association or an object.');
          }
        });

        it('throws an error if included DaoFactory is not associated', async function() {
          try {
            await this.Worker.findAll({ include: [this.Task] });
          } catch (err) {
            expect(err.message).to.equal('TaskBelongsTo is not associated to Worker!');
          }
        });

        it('returns the associated worker via task.worker', async function() {
          const tasks = await this.Task.findAll({
            where: { title: 'homework' },
            include: [this.Worker]
          });

          expect(tasks).to.exist;
          expect(tasks[0].Worker).to.exist;
          expect(tasks[0].Worker.name).to.equal('worker');
        });

        it('returns the associated worker via task.worker, using limit and sort', async function() {
          const tasks = await this.Task.findAll({
            where: { title: 'homework' },
            include: [this.Worker],
            limit: 1,
            order: [['title', 'DESC']]
          });

          expect(tasks).to.exist;
          expect(tasks[0].Worker).to.exist;
          expect(tasks[0].Worker.name).to.equal('worker');
        });
      });

      describe('hasOne', () => {
        beforeEach(async function() {
          this.Task = this.sequelize.define('TaskHasOne', { title: Sequelize.STRING });
          this.Worker = this.sequelize.define('Worker', { name: Sequelize.STRING });
          this.Worker.hasOne(this.Task);
          await this.Worker.sync({ force: true });
          await this.Task.sync({ force: true });
          const worker = await this.Worker.create({ name: 'worker' });
          const task = await this.Task.create({ title: 'homework' });
          this.worker = worker;
          this.task = task;
          await this.worker.setTaskHasOne(this.task);
        });

        it('throws an error if included DaoFactory is not associated', async function() {
          try {
            await this.Task.findAll({ include: [this.Worker] });
          } catch (err) {
            expect(err.message).to.equal('Worker is not associated to TaskHasOne!');
          }
        });

        it('returns the associated task via worker.task', async function() {
          const workers = await this.Worker.findAll({
            where: { name: 'worker' },
            include: [this.Task]
          });

          expect(workers).to.exist;
          expect(workers[0].TaskHasOne).to.exist;
          expect(workers[0].TaskHasOne.title).to.equal('homework');
        });
      });

      describe('hasOne with alias', () => {
        beforeEach(async function() {
          this.Task = this.sequelize.define('Task', { title: Sequelize.STRING });
          this.Worker = this.sequelize.define('Worker', { name: Sequelize.STRING });
          this.Worker.hasOne(this.Task, { as: 'ToDo' });
          await this.Worker.sync({ force: true });
          await this.Task.sync({ force: true });
          const worker = await this.Worker.create({ name: 'worker' });
          const task = await this.Task.create({ title: 'homework' });
          this.worker = worker;
          this.task = task;
          await this.worker.setToDo(this.task);
        });

        it('throws an error if included DaoFactory is not referenced by alias', async function() {
          try {
            await this.Worker.findAll({ include: [this.Task] });
          } catch (err) {
            expect(err.message).to.equal('Task is associated to Worker using an alias. ' +
            'You must use the \'as\' keyword to specify the alias within your include statement.');
          }
        });

        it('throws an error if alias is not associated', async function() {
          try {
            await this.Worker.findAll({ include: [{ model: this.Task, as: 'Work' }] });
          } catch (err) {
            expect(err.message).to.equal('Task is associated to Worker using an alias. ' +
            'You\'ve included an alias (Work), but it does not match the alias(es) defined in your association (ToDo).');
          }
        });

        it('returns the associated task via worker.task', async function() {
          const workers = await this.Worker.findAll({
            where: { name: 'worker' },
            include: [{ model: this.Task, as: 'ToDo' }]
          });

          expect(workers).to.exist;
          expect(workers[0].ToDo).to.exist;
          expect(workers[0].ToDo.title).to.equal('homework');
        });

        it('returns the associated task via worker.task when daoFactory is aliased with model', async function() {
          const workers = await this.Worker.findAll({
            where: { name: 'worker' },
            include: [{ model: this.Task, as: 'ToDo' }]
          });

          expect(workers[0].ToDo.title).to.equal('homework');
        });
      });

      describe('hasMany', () => {
        beforeEach(async function() {
          this.Task = this.sequelize.define('task', { title: Sequelize.STRING });
          this.Worker = this.sequelize.define('worker', { name: Sequelize.STRING });
          this.Worker.hasMany(this.Task);
          await this.Worker.sync({ force: true });
          await this.Task.sync({ force: true });
          const worker = await this.Worker.create({ name: 'worker' });
          const task = await this.Task.create({ title: 'homework' });
          this.worker = worker;
          this.task = task;
          await this.worker.setTasks([this.task]);
        });

        it('throws an error if included DaoFactory is not associated', async function() {
          try {
            await this.Task.findAll({ include: [this.Worker] });
          } catch (err) {
            expect(err.message).to.equal('worker is not associated to task!');
          }
        });

        it('returns the associated tasks via worker.tasks', async function() {
          const workers = await this.Worker.findAll({
            where: { name: 'worker' },
            include: [this.Task]
          });

          expect(workers).to.exist;
          expect(workers[0].tasks).to.exist;
          expect(workers[0].tasks[0].title).to.equal('homework');
        });

        // https://github.com/sequelize/sequelize/issues/8739
        it('supports sorting on renamed sub-query attribute', async function() {
          const User = this.sequelize.define('user', {
            name: {
              type: Sequelize.STRING,
              field: 'some_other_name'
            }
          });
          const Project = this.sequelize.define('project', { title: Sequelize.STRING });
          User.hasMany(Project);

          await User.sync({ force: true });
          await Project.sync({ force: true });

          await User.bulkCreate([
            { name: 'a' },
            { name: 'b' },
            { name: 'c' }
          ]);

          const users = await User.findAll({
            order: ['name'],
            limit: 2, // to force use of a sub-query
            include: [Project]
          });

          expect(users).to.have.lengthOf(2);
          expect(users[0].name).to.equal('a');
          expect(users[1].name).to.equal('b');
        });

        it('supports sorting DESC on renamed sub-query attribute', async function() {
          const User = this.sequelize.define('user', {
            name: {
              type: Sequelize.STRING,
              field: 'some_other_name'
            }
          });
          const Project = this.sequelize.define('project', { title: Sequelize.STRING });
          User.hasMany(Project);

          await User.sync({ force: true });
          await Project.sync({ force: true });

          await User.bulkCreate([
            { name: 'a' },
            { name: 'b' },
            { name: 'c' }
          ]);

          const users = await User.findAll({
            order: [['name', 'DESC']],
            limit: 2,
            include: [Project]
          });

          expect(users).to.have.lengthOf(2);
          expect(users[0].name).to.equal('c');
          expect(users[1].name).to.equal('b');
        });

        it('supports sorting on multiple renamed sub-query attributes', async function() {
          const User = this.sequelize.define('user', {
            name: {
              type: Sequelize.STRING,
              field: 'some_other_name'
            },
            age: {
              type: Sequelize.INTEGER,
              field: 'a_g_e'
            }
          });
          const Project = this.sequelize.define('project', { title: Sequelize.STRING });
          User.hasMany(Project);

          await User.sync({ force: true });
          await Project.sync({ force: true });

          await User.bulkCreate([
            { name: 'a', age: 1 },
            { name: 'a', age: 2 },
            { name: 'b', age: 3 }
          ]);

          const users0 = await User.findAll({
            order: [['name', 'ASC'], ['age', 'DESC']],
            limit: 2,
            include: [Project]
          });

          expect(users0).to.have.lengthOf(2);
          expect(users0[0].name).to.equal('a');
          expect(users0[0].age).to.equal(2);
          expect(users0[1].name).to.equal('a');
          expect(users0[1].age).to.equal(1);

          const users = await User.findAll({
            order: [['name', 'DESC'], 'age'],
            limit: 2,
            include: [Project]
          });

          expect(users).to.have.lengthOf(2);
          expect(users[0].name).to.equal('b');
          expect(users[1].name).to.equal('a');
          expect(users[1].age).to.equal(1);
        });
      });

      describe('hasMany with alias', () => {
        beforeEach(async function() {
          this.Task = this.sequelize.define('Task', { title: Sequelize.STRING });
          this.Worker = this.sequelize.define('Worker', { name: Sequelize.STRING });
          this.Worker.hasMany(this.Task, { as: 'ToDos' });
          await this.Worker.sync({ force: true });
          await this.Task.sync({ force: true });
          const worker = await this.Worker.create({ name: 'worker' });
          const task = await this.Task.create({ title: 'homework' });
          this.worker = worker;
          this.task = task;
          await this.worker.setToDos([this.task]);
        });

        it('throws an error if included DaoFactory is not referenced by alias', async function() {
          try {
            await this.Worker.findAll({ include: [this.Task] });
          } catch (err) {
            expect(err.message).to.equal('Task is associated to Worker using an alias. ' +
            'You must use the \'as\' keyword to specify the alias within your include statement.');
          }
        });

        it('throws an error if alias is not associated', async function() {
          try {
            await this.Worker.findAll({ include: [{ model: this.Task, as: 'Work' }] });
          } catch (err) {
            expect(err.message).to.equal('Task is associated to Worker using an alias. ' +
            'You\'ve included an alias (Work), but it does not match the alias(es) defined in your association (ToDos).');
          }
        });

        it('returns the associated task via worker.task', async function() {
          const workers = await this.Worker.findAll({
            where: { name: 'worker' },
            include: [{ model: this.Task, as: 'ToDos' }]
          });

          expect(workers).to.exist;
          expect(workers[0].ToDos).to.exist;
          expect(workers[0].ToDos[0].title).to.equal('homework');
        });

        it('returns the associated task via worker.task when daoFactory is aliased with model', async function() {
          const workers = await this.Worker.findAll({
            where: { name: 'worker' },
            include: [{ model: this.Task, as: 'ToDos' }]
          });

          expect(workers[0].ToDos[0].title).to.equal('homework');
        });
      });

      describe('queryOptions', () => {
        beforeEach(async function() {
          const user = await this.User.create({ username: 'barfooz' });
          this.user = user;
        });

        it('should return a DAO when queryOptions are not set', async function() {
          const users = await this.User.findAll({ where: { username: 'barfooz' } });
          users.forEach(user => {
            expect(user).to.be.instanceOf(this.User);
          });
        });

        it('should return a DAO when raw is false', async function() {
          const users = await this.User.findAll({ where: { username: 'barfooz' }, raw: false });
          users.forEach(user => {
            expect(user).to.be.instanceOf(this.User);
          });
        });

        it('should return raw data when raw is true', async function() {
          const users = await this.User.findAll({ where: { username: 'barfooz' }, raw: true });
          users.forEach(user => {
            expect(user).to.not.be.instanceOf(this.User);
            expect(users[0]).to.be.instanceOf(Object);
          });
        });
      });

      describe('include all', () => {
        beforeEach(async function() {
          this.Continent = this.sequelize.define('continent', { name: Sequelize.STRING });
          this.Country = this.sequelize.define('country', { name: Sequelize.STRING });
          this.Industry = this.sequelize.define('industry', { name: Sequelize.STRING });
          this.Person = this.sequelize.define('person', { name: Sequelize.STRING, lastName: Sequelize.STRING });

          this.Continent.hasMany(this.Country);
          this.Country.belongsTo(this.Continent);
          this.Country.belongsToMany(this.Industry, { through: 'country_industry' });
          this.Industry.belongsToMany(this.Country, { through: 'country_industry' });
          this.Country.hasMany(this.Person);
          this.Person.belongsTo(this.Country);
          this.Country.hasMany(this.Person, { as: 'residents', foreignKey: 'CountryResidentId' });
          this.Person.belongsTo(this.Country, { as: 'CountryResident', foreignKey: 'CountryResidentId' });

          await this.sequelize.sync({ force: true });

          const r = await promiseProps({
            europe: this.Continent.create({ name: 'Europe' }),
            england: this.Country.create({ name: 'England' }),
            coal: this.Industry.create({ name: 'Coal' }),
            bob: this.Person.create({ name: 'Bob', lastName: 'Becket' })
          });

          _.forEach(r, (item, itemName) => {
            this[itemName] = item;
          });

          await Promise.all([
            this.england.setContinent(this.europe),
            this.england.addIndustry(this.coal),
            this.bob.setCountry(this.england),
            this.bob.setCountryResident(this.england)
          ]);
        });

        it('includes all associations', async function() {
          const countries = await this.Country.findAll({ include: [{ all: true }] });
          expect(countries).to.exist;
          expect(countries[0]).to.exist;
          expect(countries[0].continent).to.exist;
          expect(countries[0].industries).to.exist;
          expect(countries[0].people).to.exist;
          expect(countries[0].residents).to.exist;
        });

        it('includes specific type of association', async function() {
          const countries = await this.Country.findAll({ include: [{ all: 'BelongsTo' }] });
          expect(countries).to.exist;
          expect(countries[0]).to.exist;
          expect(countries[0].continent).to.exist;
          expect(countries[0].industries).not.to.exist;
          expect(countries[0].people).not.to.exist;
          expect(countries[0].residents).not.to.exist;
        });

        it('utilises specified attributes', async function() {
          const countries = await this.Country.findAll({ include: [{ all: 'HasMany', attributes: ['name'] }] });
          expect(countries).to.exist;
          expect(countries[0]).to.exist;
          expect(countries[0].people).to.exist;
          expect(countries[0].people[0]).to.exist;
          expect(countries[0].people[0].name).not.to.be.undefined;
          expect(countries[0].people[0].lastName).to.be.undefined;
          expect(countries[0].residents).to.exist;
          expect(countries[0].residents[0]).to.exist;
          expect(countries[0].residents[0].name).not.to.be.undefined;
          expect(countries[0].residents[0].lastName).to.be.undefined;
        });

        it('is over-ruled by specified include', async function() {
          const countries = await this.Country.findAll({ include: [{ all: true }, { model: this.Continent, attributes: ['id'] }] });
          expect(countries).to.exist;
          expect(countries[0]).to.exist;
          expect(countries[0].continent).to.exist;
          expect(countries[0].continent.name).to.be.undefined;
        });

        it('includes all nested associations', async function() {
          const continents = await this.Continent.findAll({ include: [{ all: true, nested: true }] });
          expect(continents).to.exist;
          expect(continents[0]).to.exist;
          expect(continents[0].countries).to.exist;
          expect(continents[0].countries[0]).to.exist;
          expect(continents[0].countries[0].industries).to.exist;
          expect(continents[0].countries[0].people).to.exist;
          expect(continents[0].countries[0].residents).to.exist;
          expect(continents[0].countries[0].continent).not.to.exist;
        });
      });

      describe('properly handles attributes:[] cases', () => {
        beforeEach(async function() {
          this.Animal = this.sequelize.define('Animal', {
            name: Sequelize.STRING,
            age: Sequelize.INTEGER
          });
          this.Kingdom = this.sequelize.define('Kingdom', {
            name: Sequelize.STRING
          });
          this.AnimalKingdom = this.sequelize.define('AnimalKingdom', {
            relation: Sequelize.STRING,
            mutation: Sequelize.BOOLEAN
          });

          this.Kingdom.belongsToMany(this.Animal, { through: this.AnimalKingdom });

          await this.sequelize.sync({ force: true });

          const [a1, a2, a3, a4] = await Promise.all([
            this.Animal.create({ name: 'Dog', age: 20 }),
            this.Animal.create({ name: 'Cat', age: 30 }),
            this.Animal.create({ name: 'Peacock', age: 25 }),
            this.Animal.create({ name: 'Fish', age: 100 })
          ]);

          const [k1, k2, k3] = await Promise.all([
            this.Kingdom.create({ name: 'Earth' }),
            this.Kingdom.create({ name: 'Water' }),
            this.Kingdom.create({ name: 'Wind' })
          ]);

          await Promise.all([
            k1.addAnimals([a1, a2]),
            k2.addAnimals([a4]),
            k3.addAnimals([a3])
          ]);
        });

        it('N:M with ignoring include.attributes only', async function() {
          const kingdoms = await this.Kingdom.findAll({
            include: [{
              model: this.Animal,
              where: { age: { [Op.gte]: 29 } },
              attributes: []
            }]
          });

          expect(kingdoms.length).to.be.eql(2);
          kingdoms.forEach(kingdom => {
            // include.attributes:[] , model doesn't exists
            expect(kingdom.Animals).to.not.exist;
          });
        });

        it('N:M with ignoring through.attributes only', async function() {
          const kingdoms = await this.Kingdom.findAll({
            include: [{
              model: this.Animal,
              where: { age: { [Op.gte]: 29 } },
              through: {
                attributes: []
              }
            }]
          });

          expect(kingdoms.length).to.be.eql(2);
          kingdoms.forEach(kingdom => {
            expect(kingdom.Animals).to.exist; // include model exists
            expect(kingdom.Animals[0].AnimalKingdom).to.not.exist; // through doesn't exists
          });
        });

        it('N:M with ignoring include.attributes but having through.attributes', async function() {
          const kingdoms = await this.Kingdom.findAll({
            include: [{
              model: this.Animal,
              where: { age: { [Op.gte]: 29 } },
              attributes: [],
              through: {
                attributes: ['mutation']
              }
            }]
          });

          expect(kingdoms.length).to.be.eql(2);
          kingdoms.forEach(kingdom => {
            // include.attributes: [], model doesn't exists
            expect(kingdom.Animals).to.not.exist;
          });
        });
      });
    });

    describe('order by eager loaded tables', () => {
      describe('HasMany', () => {
        beforeEach(async function() {
          this.Continent = this.sequelize.define('continent', { name: Sequelize.STRING });
          this.Country = this.sequelize.define('country', { name: Sequelize.STRING });
          this.Person = this.sequelize.define('person', { name: Sequelize.STRING, lastName: Sequelize.STRING });

          this.Continent.hasMany(this.Country);
          this.Country.belongsTo(this.Continent);
          this.Country.hasMany(this.Person);
          this.Person.belongsTo(this.Country);
          this.Country.hasMany(this.Person, { as: 'residents', foreignKey: 'CountryResidentId' });
          this.Person.belongsTo(this.Country, { as: 'CountryResident', foreignKey: 'CountryResidentId' });

          await this.sequelize.sync({ force: true });

          const r = await promiseProps({
            europe: this.Continent.create({ name: 'Europe' }),
            asia: this.Continent.create({ name: 'Asia' }),
            england: this.Country.create({ name: 'England' }),
            france: this.Country.create({ name: 'France' }),
            korea: this.Country.create({ name: 'Korea' }),
            bob: this.Person.create({ name: 'Bob', lastName: 'Becket' }),
            fred: this.Person.create({ name: 'Fred', lastName: 'Able' }),
            pierre: this.Person.create({ name: 'Pierre', lastName: 'Paris' }),
            kim: this.Person.create({ name: 'Kim', lastName: 'Z' })
          });

          _.forEach(r, (item, itemName) => {
            this[itemName] = item;
          });

          await Promise.all([
            this.england.setContinent(this.europe),
            this.france.setContinent(this.europe),
            this.korea.setContinent(this.asia),

            this.bob.setCountry(this.england),
            this.fred.setCountry(this.england),
            this.pierre.setCountry(this.france),
            this.kim.setCountry(this.korea),

            this.bob.setCountryResident(this.england),
            this.fred.setCountryResident(this.france),
            this.pierre.setCountryResident(this.korea),
            this.kim.setCountryResident(this.england)
          ]);
        });

        it('sorts simply', async function() {
          await Promise.all([['ASC', 'Asia'], ['DESC', 'Europe']].map(async params => {
            const continents = await this.Continent.findAll({
              order: [['name', params[0]]]
            });

            expect(continents).to.exist;
            expect(continents[0]).to.exist;
            expect(continents[0].name).to.equal(params[1]);
          }));
        });

        it('sorts by 1st degree association', async function() {
          await Promise.all([['ASC', 'Europe', 'England'], ['DESC', 'Asia', 'Korea']].map(async params => {
            const continents = await this.Continent.findAll({
              include: [this.Country],
              order: [[this.Country, 'name', params[0]]]
            });

            expect(continents).to.exist;
            expect(continents[0]).to.exist;
            expect(continents[0].name).to.equal(params[1]);
            expect(continents[0].countries).to.exist;
            expect(continents[0].countries[0]).to.exist;
            expect(continents[0].countries[0].name).to.equal(params[2]);
          }));
        });

        it('sorts simply and by 1st degree association with limit where 1st degree associated instances returned for second one and not the first', async function() {
          await Promise.all([['ASC', 'Asia', 'Europe', 'England']].map(async params => {
            const continents = await this.Continent.findAll({
              include: [{
                model: this.Country,
                required: false,
                where: {
                  name: params[3]
                }
              }],
              limit: 2,
              order: [['name', params[0]], [this.Country, 'name', params[0]]]
            });

            expect(continents).to.exist;
            expect(continents[0]).to.exist;
            expect(continents[0].name).to.equal(params[1]);
            expect(continents[0].countries).to.exist;
            expect(continents[0].countries.length).to.equal(0);
            expect(continents[1]).to.exist;
            expect(continents[1].name).to.equal(params[2]);
            expect(continents[1].countries).to.exist;
            expect(continents[1].countries.length).to.equal(1);
            expect(continents[1].countries[0]).to.exist;
            expect(continents[1].countries[0].name).to.equal(params[3]);
          }));
        });

        it('sorts by 2nd degree association', async function() {
          await Promise.all([['ASC', 'Europe', 'England', 'Fred'], ['DESC', 'Asia', 'Korea', 'Kim']].map(async params => {
            const continents = await this.Continent.findAll({
              include: [{ model: this.Country, include: [this.Person] }],
              order: [[this.Country, this.Person, 'lastName', params[0]]]
            });

            expect(continents).to.exist;
            expect(continents[0]).to.exist;
            expect(continents[0].name).to.equal(params[1]);
            expect(continents[0].countries).to.exist;
            expect(continents[0].countries[0]).to.exist;
            expect(continents[0].countries[0].name).to.equal(params[2]);
            expect(continents[0].countries[0].people).to.exist;
            expect(continents[0].countries[0].people[0]).to.exist;
            expect(continents[0].countries[0].people[0].name).to.equal(params[3]);
          }));
        });

        it('sorts by 2nd degree association with alias', async function() {
          await Promise.all([['ASC', 'Europe', 'France', 'Fred'], ['DESC', 'Europe', 'England', 'Kim']].map(async params => {
            const continents = await this.Continent.findAll({
              include: [{ model: this.Country, include: [this.Person, { model: this.Person, as: 'residents' }] }],
              order: [[this.Country, { model: this.Person, as: 'residents' }, 'lastName', params[0]]]
            });

            expect(continents).to.exist;
            expect(continents[0]).to.exist;
            expect(continents[0].name).to.equal(params[1]);
            expect(continents[0].countries).to.exist;
            expect(continents[0].countries[0]).to.exist;
            expect(continents[0].countries[0].name).to.equal(params[2]);
            expect(continents[0].countries[0].residents).to.exist;
            expect(continents[0].countries[0].residents[0]).to.exist;
            expect(continents[0].countries[0].residents[0].name).to.equal(params[3]);
          }));
        });

        it('sorts by 2nd degree association with alias while using limit', async function() {
          await Promise.all([['ASC', 'Europe', 'France', 'Fred'], ['DESC', 'Europe', 'England', 'Kim']].map(async params => {
            const continents = await this.Continent.findAll({
              include: [{ model: this.Country, include: [this.Person, { model: this.Person, as: 'residents' }] }],
              order: [[{ model: this.Country }, { model: this.Person, as: 'residents' }, 'lastName', params[0]]],
              limit: 3
            });

            expect(continents).to.exist;
            expect(continents[0]).to.exist;
            expect(continents[0].name).to.equal(params[1]);
            expect(continents[0].countries).to.exist;
            expect(continents[0].countries[0]).to.exist;
            expect(continents[0].countries[0].name).to.equal(params[2]);
            expect(continents[0].countries[0].residents).to.exist;
            expect(continents[0].countries[0].residents[0]).to.exist;
            expect(continents[0].countries[0].residents[0].name).to.equal(params[3]);
          }));
        });
      });

      describe('ManyToMany', () => {
        beforeEach(async function() {
          this.Country = this.sequelize.define('country', { name: Sequelize.STRING });
          this.Industry = this.sequelize.define('industry', { name: Sequelize.STRING });
          this.IndustryCountry = this.sequelize.define('IndustryCountry', { numYears: Sequelize.INTEGER });

          this.Country.belongsToMany(this.Industry, { through: this.IndustryCountry });
          this.Industry.belongsToMany(this.Country, { through: this.IndustryCountry });

          await this.sequelize.sync({ force: true });

          const r = await promiseProps({
            england: this.Country.create({ name: 'England' }),
            france: this.Country.create({ name: 'France' }),
            korea: this.Country.create({ name: 'Korea' }),
            energy: this.Industry.create({ name: 'Energy' }),
            media: this.Industry.create({ name: 'Media' }),
            tech: this.Industry.create({ name: 'Tech' })
          });

          _.forEach(r, (item, itemName) => {
            this[itemName] = item;
          });

          await Promise.all([
            this.england.addIndustry(this.energy, { through: { numYears: 20 } }),
            this.england.addIndustry(this.media, { through: { numYears: 40 } }),
            this.france.addIndustry(this.media, { through: { numYears: 80 } }),
            this.korea.addIndustry(this.tech, { through: { numYears: 30 } })
          ]);
        });

        it('sorts by 1st degree association', async function() {
          await Promise.all([['ASC', 'England', 'Energy'], ['DESC', 'Korea', 'Tech']].map(async params => {
            const countries = await this.Country.findAll({
              include: [this.Industry],
              order: [[this.Industry, 'name', params[0]]]
            });

            expect(countries).to.exist;
            expect(countries[0]).to.exist;
            expect(countries[0].name).to.equal(params[1]);
            expect(countries[0].industries).to.exist;
            expect(countries[0].industries[0]).to.exist;
            expect(countries[0].industries[0].name).to.equal(params[2]);
          }));
        });

        it('sorts by 1st degree association while using limit', async function() {
          await Promise.all([['ASC', 'England', 'Energy'], ['DESC', 'Korea', 'Tech']].map(async params => {
            const countries = await this.Country.findAll({
              include: [this.Industry],
              order: [
                [this.Industry, 'name', params[0]]
              ],
              limit: 3
            });

            expect(countries).to.exist;
            expect(countries[0]).to.exist;
            expect(countries[0].name).to.equal(params[1]);
            expect(countries[0].industries).to.exist;
            expect(countries[0].industries[0]).to.exist;
            expect(countries[0].industries[0].name).to.equal(params[2]);
          }));
        });

        it('sorts by through table attribute', async function() {
          await Promise.all([['ASC', 'England', 'Energy'], ['DESC', 'France', 'Media']].map(async params => {
            const countries = await this.Country.findAll({
              include: [this.Industry],
              order: [[this.Industry, this.IndustryCountry, 'numYears', params[0]]]
            });

            expect(countries).to.exist;
            expect(countries[0]).to.exist;
            expect(countries[0].name).to.equal(params[1]);
            expect(countries[0].industries).to.exist;
            expect(countries[0].industries[0]).to.exist;
            expect(countries[0].industries[0].name).to.equal(params[2]);
          }));
        });
      });
    });

    describe('normal findAll', () => {
      beforeEach(async function() {
        const user = await this.User.create({ username: 'user', data: 'foobar', theDate: moment().toDate() });
        const user2 = await this.User.create({ username: 'user2', data: 'bar', theDate: moment().toDate() });
        this.users = [user].concat(user2);
      });

      it('finds all entries', async function() {
        const users = await this.User.findAll();
        expect(users.length).to.equal(2);
      });

      it('can also handle object notation', async function() {
        const users = await this.User.findAll({ where: { id: this.users[1].id } });
        expect(users.length).to.equal(1);
        expect(users[0].id).to.equal(this.users[1].id);
      });

      it('sorts the results via id in ascending order', async function() {
        const users = await this.User.findAll();
        expect(users.length).to.equal(2);
        expect(users[0].id).to.be.below(users[1].id);
      });

      it('sorts the results via id in descending order', async function() {
        const users = await this.User.findAll({ order: [['id', 'DESC']] });
        expect(users[0].id).to.be.above(users[1].id);
      });

      it('sorts the results via a date column', async function() {
        await this.User.create({ username: 'user3', data: 'bar', theDate: moment().add(2, 'hours').toDate() });
        const users = await this.User.findAll({ order: [['theDate', 'DESC']] });
        expect(users[0].id).to.be.above(users[2].id);
      });

      it('handles offset and limit', async function() {
        await this.User.bulkCreate([{ username: 'bobby' }, { username: 'tables' }]);
        const users = await this.User.findAll({ limit: 2, offset: 2 });
        expect(users.length).to.equal(2);
        expect(users[0].id).to.equal(3);
      });

      it('should allow us to find IDs using capital letters', async function() {
        const User = this.sequelize.define(`User${Support.rand()}`, {
          ID: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          Login: { type: Sequelize.STRING }
        });

        await User.sync({ force: true });
        await User.create({ Login: 'foo' });
        const user = await User.findAll({ where: { ID: 1 } });
        expect(user).to.be.instanceof(Array);
        expect(user).to.have.length(1);
      });

      it('should be possible to order by sequelize.col()', async function() {
        const Company = this.sequelize.define('Company', {
          name: Sequelize.STRING
        });

        await Company.sync();

        await Company.findAll({
          order: [this.sequelize.col('name')]
        });
      });

      it('should pull in dependent fields for a VIRTUAL', async function() {
        const User = this.sequelize.define('User', {
          active: {
            type: Sequelize.VIRTUAL(Sequelize.BOOLEAN, ['createdAt']),
            get() {
              return this.get('createdAt') > Date.now() - 7 * 24 * 60 * 60 * 1000;
            }
          }
        }, {
          timestamps: true
        });

        await User.create();

        const users = await User.findAll({
          attributes: ['active']
        });

        users.forEach(user => {
          expect(user.get('createdAt')).to.be.ok;
          expect(user.get('active')).to.equal(true);
        });
      });

      it('should pull in dependent fields for a VIRTUAL in include', async function() {
        const User = this.sequelize.define('User', {
          name: Sequelize.STRING
        });

        const Image = this.sequelize.define('Image', {
          path: {
            type: Sequelize.STRING,
            allowNull: false
          },
          url: {
            type: Sequelize.VIRTUAL(Sequelize.STRING, ['path']),
            get() {
              return `https://my-cool-domain.com/${this.get('path')}`;
            }
          }
        });

        User.hasOne(Image);
        Image.belongsTo(User);

        await this.sequelize.sync({ force: true });

        await User.create({
          name: 'some user',
          Image: {
            path: 'folder1/folder2/logo.png'
          }
        }, {
          include: {
            model: Image
          }
        });

        const users = await User.findAll({
          attributes: ['name'],
          include: [{
            model: Image,
            attributes: ['url']
          }]
        });

        users.forEach(user => {
          expect(user.get('name')).to.equal('some user');
          expect(user.Image.get('url')).to.equal('https://my-cool-domain.com/folder1/folder2/logo.png');
          expect(user.Image.get('path')).to.equal('folder1/folder2/logo.png');
        });
      });

      it('should throw for undefined where parameters', async function() {
        try {
          await this.User.findAll({ where: { username: undefined } });
          throw new Error('findAll should throw an error if where has a key with undefined value');
        } catch (err) {
          expect(err).to.be.an.instanceof(Error);
          expect(err.message).to.equal('WHERE parameter "username" has invalid "undefined" value');
        }
      });
    });
  });

  describe('findAndCountAll', () => {
    beforeEach(async function() {
      await this.User.bulkCreate([
        { username: 'user', data: 'foobar' },
        { username: 'user2', data: 'bar' },
        { username: 'bobby', data: 'foo' }
      ]);

      const users = await this.User.findAll();
      this.users = users;
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', async function() {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: Sequelize.STRING });

        await User.sync({ force: true });
        const t = await sequelize.transaction();
        await User.create({ username: 'foo' }, { transaction: t });
        const info1 = await User.findAndCountAll();
        const info2 = await User.findAndCountAll({ transaction: t });
        expect(info1.count).to.equal(0);
        expect(info2.count).to.equal(1);
        await t.rollback();
      });
    }

    it('handles where clause {only}', async function() {
      const info = await this.User.findAndCountAll({ where: { id: { [Op.ne]: this.users[0].id } } });
      expect(info.count).to.equal(2);
      expect(Array.isArray(info.rows)).to.be.ok;
      expect(info.rows.length).to.equal(2);
    });

    it('handles where clause with ordering {only}', async function() {
      const info = await this.User.findAndCountAll({ where: { id: { [Op.ne]: this.users[0].id } }, order: [['id', 'ASC']] });
      expect(info.count).to.equal(2);
      expect(Array.isArray(info.rows)).to.be.ok;
      expect(info.rows.length).to.equal(2);
    });

    it('handles offset', async function() {
      const info = await this.User.findAndCountAll({ offset: 1 });
      expect(info.count).to.equal(3);
      expect(Array.isArray(info.rows)).to.be.ok;
      expect(info.rows.length).to.equal(2);
    });

    it('handles limit', async function() {
      const info = await this.User.findAndCountAll({ limit: 1 });
      expect(info.count).to.equal(3);
      expect(Array.isArray(info.rows)).to.be.ok;
      expect(info.rows.length).to.equal(1);
    });

    it('handles offset and limit', async function() {
      const info = await this.User.findAndCountAll({ offset: 1, limit: 1 });
      expect(info.count).to.equal(3);
      expect(Array.isArray(info.rows)).to.be.ok;
      expect(info.rows.length).to.equal(1);
    });

    it('handles offset with includes', async function() {
      const Election = this.sequelize.define('Election', {
        name: Sequelize.STRING
      });
      const Citizen = this.sequelize.define('Citizen', {
        name: Sequelize.STRING
      });

      // Associations
      Election.belongsTo(Citizen);
      Election.belongsToMany(Citizen, { as: 'Voters', through: 'ElectionsVotes' });
      Citizen.hasMany(Election);
      Citizen.belongsToMany(Election, { as: 'Votes', through: 'ElectionsVotes' });

      await this.sequelize.sync();
      // Add some data
      const alice = await Citizen.create({ name: 'Alice' });
      const bob = await Citizen.create({ name: 'Bob' });
      await Election.create({ name: 'Some election' });
      const election = await Election.create({ name: 'Some other election' });
      await election.setCitizen(alice);
      await election.setVoters([alice, bob]);
      const criteria = {
        offset: 5,
        limit: 1,
        where: {
          name: 'Some election'
        },
        include: [
          Citizen, // Election creator
          { model: Citizen, as: 'Voters' } // Election voters
        ]
      };
      const elections = await Election.findAndCountAll(criteria);
      expect(elections.count).to.equal(1);
      expect(elections.rows.length).to.equal(0);
    });

    it('handles attributes', async function() {
      const info = await this.User.findAndCountAll({ where: { id: { [Op.ne]: this.users[0].id } }, attributes: ['data'] });
      expect(info.count).to.equal(2);
      expect(Array.isArray(info.rows)).to.be.ok;
      expect(info.rows.length).to.equal(2);
      expect(info.rows[0].dataValues).to.not.have.property('username');
      expect(info.rows[1].dataValues).to.not.have.property('username');
    });
  });

  describe('all', () => {
    beforeEach(async function() {
      await this.User.bulkCreate([
        { username: 'user', data: 'foobar' },
        { username: 'user2', data: 'bar' }
      ]);
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', async function() {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: Sequelize.STRING });

        await User.sync({ force: true });
        const t = await sequelize.transaction();
        await User.create({ username: 'foo' }, { transaction: t });
        const users1 = await User.findAll();
        const users2 = await User.findAll({ transaction: t });
        expect(users1.length).to.equal(0);
        expect(users2.length).to.equal(1);
        await t.rollback();
      });
    }

    it('should return all users', async function() {
      const users = await this.User.findAll();
      expect(users.length).to.equal(2);
    });
  });

  it('should support logging', async function() {
    const spy = sinon.spy();

    await this.User.findAll({
      where: {},
      logging: spy
    });

    expect(spy.called).to.be.ok;
  });

  describe('rejectOnEmpty mode', () => {
    it('works from model options', async () => {
      const Model = current.define('Test', {
        username: Sequelize.STRING(100)
      }, {
        rejectOnEmpty: true
      });

      await Model.sync({ force: true });

      await expect(Model.findAll({
        where: {
          username: 'some-username-that-is-not-used-anywhere'
        }
      })).to.eventually.be.rejectedWith(Sequelize.EmptyResultError);
    });

    it('throws custom error with initialized', async () => {
      const Model = current.define('Test', {
        username: Sequelize.STRING(100)
      }, {
        rejectOnEmpty: new Sequelize.ConnectionError('Some Error') //using custom error instance
      });

      await Model.sync({ force: true });

      await expect(Model.findAll({
        where: {
          username: 'some-username-that-is-not-used-anywhere-for-sure-this-time'
        }
      })).to.eventually.be.rejectedWith(Sequelize.ConnectionError);
    });

    it('throws custom error with instance', async () => {
      const Model = current.define('Test', {
        username: Sequelize.STRING(100)
      }, {
        rejectOnEmpty: Sequelize.ConnectionError //using custom error instance
      });

      await Model.sync({ force: true });

      await expect(Model.findAll({
        where: {
          username: 'some-username-that-is-not-used-anywhere-for-sure-this-time'
        }
      })).to.eventually.be.rejectedWith(Sequelize.ConnectionError);
    });
  });
});
