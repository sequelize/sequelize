'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  Sequelize = require('sequelize'),
  expect = chai.expect,
  Support = require('../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require('sequelize/lib/data-types'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  beforeEach(async function() {
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      secretValue: DataTypes.STRING,
      data: DataTypes.STRING,
      intVal: DataTypes.INTEGER,
      theDate: DataTypes.DATE,
      aBool: DataTypes.BOOLEAN
    });

    await this.User.sync({ force: true });
  });

  describe('findOne', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', async function() {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: Sequelize.STRING });

        await User.sync({ force: true });
        const t = await sequelize.transaction();
        await User.create({ username: 'foo' }, { transaction: t });

        const user1 = await User.findOne({
          where: { username: 'foo' }
        });

        const user2 = await User.findOne({
          where: { username: 'foo' },
          transaction: t
        });

        expect(user1).to.be.null;
        expect(user2).to.not.be.null;
        await t.rollback();
      });
    }

    describe('general / basic function', () => {
      beforeEach(async function() {
        const user = await this.User.create({ username: 'barfooz' });
        this.UserPrimary = this.sequelize.define('UserPrimary', {
          specialkey: {
            type: DataTypes.STRING,
            primaryKey: true
          }
        });

        await this.UserPrimary.sync({ force: true });
        await this.UserPrimary.create({ specialkey: 'a string' });
        this.user = user;
      });

      if (dialect === 'mysql') {
        // Bit fields interpreted as boolean need conversion from buffer / bool.
        // Sqlite returns the inserted value as is, and postgres really should the built in bool type instead

        it('allows bit fields as booleans', async function() {
          let bitUser = this.sequelize.define('bituser', {
            bool: 'BIT(1)'
          }, {
            timestamps: false
          });

          // First use a custom data type def to create the bit field
          await bitUser.sync({ force: true });
          // Then change the definition to BOOLEAN
          bitUser = this.sequelize.define('bituser', {
            bool: DataTypes.BOOLEAN
          }, {
            timestamps: false
          });

          await bitUser.bulkCreate([
            { bool: 0 },
            { bool: 1 }
          ]);

          const bitUsers = await bitUser.findAll();
          expect(bitUsers[0].bool).not.to.be.ok;
          expect(bitUsers[1].bool).to.be.ok;
        });
      }

      it('treats questionmarks in an array', async function() {
        let test = false;

        await this.UserPrimary.findOne({
          where: { 'specialkey': 'awesome' },
          logging(sql) {
            test = true;
            expect(sql).to.match(/WHERE ["|`|[]UserPrimary["|`|\]]\.["|`|[]specialkey["|`|\]] = N?'awesome'/);
          }
        });

        expect(test).to.be.true;
      });

      it('doesn\'t throw an error when entering in a non integer value for a specified primary field', async function() {
        const user = await this.UserPrimary.findByPk('a string');
        expect(user.specialkey).to.equal('a string');
      });

      it('returns a single dao', async function() {
        const user = await this.User.findByPk(this.user.id);
        expect(Array.isArray(user)).to.not.be.ok;
        expect(user.id).to.equal(this.user.id);
        expect(user.id).to.equal(1);
      });

      it('returns a single dao given a string id', async function() {
        const user = await this.User.findByPk(this.user.id.toString());
        expect(Array.isArray(user)).to.not.be.ok;
        expect(user.id).to.equal(this.user.id);
        expect(user.id).to.equal(1);
      });

      it('should make aliased attributes available', async function() {
        const user = await this.User.findOne({
          where: { id: 1 },
          attributes: ['id', ['username', 'name']]
        });

        expect(user.dataValues.name).to.equal('barfooz');
      });

      it('should fail with meaningful error message on invalid attributes definition', function() {
        expect(this.User.findOne({
          where: { id: 1 },
          attributes: ['id', ['username']]
        })).to.be.rejectedWith('["username"] is not a valid attribute definition. Please use the following format: [\'attribute definition\', \'alias\']');
      });

      it('should not try to convert boolean values if they are not selected', async function() {
        const UserWithBoolean = this.sequelize.define('UserBoolean', {
          active: Sequelize.BOOLEAN
        });

        await UserWithBoolean.sync({ force: true });
        const user = await UserWithBoolean.create({ active: true });
        const user0 = await UserWithBoolean.findOne({ where: { id: user.id }, attributes: ['id'] });
        expect(user0.active).not.to.exist;
      });

      it('finds a specific user via where option', async function() {
        const user = await this.User.findOne({ where: { username: 'barfooz' } });
        expect(user.username).to.equal('barfooz');
      });

      it('doesn\'t find a user if conditions are not matching', async function() {
        const user = await this.User.findOne({ where: { username: 'foo' } });
        expect(user).to.be.null;
      });

      it('allows sql logging', async function() {
        let test = false;

        await this.User.findOne({
          where: { username: 'foo' },
          logging(sql) {
            test = true;
            expect(sql).to.exist;
            expect(sql.toUpperCase()).to.include('SELECT');
          }
        });

        expect(test).to.be.true;
      });

      it('ignores passed limit option', async function() {
        const user = await this.User.findOne({ limit: 10 });
        // it returns an object instead of an array
        expect(Array.isArray(user)).to.not.be.ok;
        expect(user.dataValues.hasOwnProperty('username')).to.be.ok;
      });

      it('finds entries via primary keys', async function() {
        const UserPrimary = this.sequelize.define('UserWithPrimaryKey', {
          identifier: { type: Sequelize.STRING, primaryKey: true },
          name: Sequelize.STRING
        });

        await UserPrimary.sync({ force: true });

        const u = await UserPrimary.create({
          identifier: 'an identifier',
          name: 'John'
        });

        expect(u.id).not.to.exist;
        const u2 = await UserPrimary.findByPk('an identifier');
        expect(u2.identifier).to.equal('an identifier');
        expect(u2.name).to.equal('John');
      });

      it('finds entries via a string primary key called id', async function() {
        const UserPrimary = this.sequelize.define('UserWithPrimaryKey', {
          id: { type: Sequelize.STRING, primaryKey: true },
          name: Sequelize.STRING
        });

        await UserPrimary.sync({ force: true });

        await UserPrimary.create({
          id: 'a string based id',
          name: 'Johnno'
        });

        const u2 = await UserPrimary.findByPk('a string based id');
        expect(u2.id).to.equal('a string based id');
        expect(u2.name).to.equal('Johnno');
      });

      it('finds entries via a bigint primary key called id', async function() {
        const UserPrimary = this.sequelize.define('UserWithPrimaryKey', {
          id: { type: DataTypes.BIGINT, primaryKey: true },
          name: DataTypes.STRING
        });

        await UserPrimary.sync({ force: true });

        await UserPrimary.create({
          id: 9007199254740993n, // Number.MAX_SAFE_INTEGER + 2 (cannot be represented exactly as a number in JS)
          name: 'Johnno'
        });

        const u2 = await UserPrimary.findByPk(9007199254740993n);
        expect(u2.name).to.equal('Johnno');

        // Getting the value back as bigint is not supported yet: https://github.com/sequelize/sequelize/issues/14296
        // With most dialects we'll receive a string, but in some cases we have to be a bit creative to prove that we did get hold of the right record:
        if (dialect === 'db2') {
          // ibm_db 2.7.4+ returns BIGINT values as JS numbers, which leads to a loss of precision:
          // https://github.com/ibmdb/node-ibm_db/issues/816
          // It means that u2.id comes back as 9007199254740992 here :(
          // Hopefully this will be fixed soon.
          // For now we can do a separate query where we stringify the value to prove that it did get stored correctly:
          const [[{ stringifiedId }]] = await this.sequelize.query(`select "id"::varchar as "stringifiedId" from "${UserPrimary.tableName}" where "id" = 9007199254740993`);
          expect(stringifiedId).to.equal('9007199254740993');
        } else if (dialect === 'mariadb') {
          // With our current default config, the mariadb driver sends back a Long instance.
          // Updating the mariadb dev dep and passing "supportBigInt: true" would get it back as a bigint,
          // but that's potentially a big change.
          // For now, we'll just stringify the Long and make the comparison:
          expect(u2.id.toString()).to.equal('9007199254740993');
        } else if (dialect === 'sqlite') {
          // sqlite3 returns a number, so u2.id comes back as 9007199254740992 here:
          // https://github.com/TryGhost/node-sqlite3/issues/922
          // For now we can do a separate query where we stringify the value to prove that it did get stored correctly:
          const [[{ stringifiedId }]] = await this.sequelize.query(`select cast("id" as text) as "stringifiedId" from "${UserPrimary.tableName}" where "id" = 9007199254740993`);
          expect(stringifiedId).to.equal('9007199254740993');
        } else {
          expect(u2.id).to.equal('9007199254740993');
        }
      });

      it('always honors ZERO as primary key', async function() {
        const permutations = [
          0,
          '0'
        ];
        let count = 0;

        await this.User.bulkCreate([{ username: 'jack' }, { username: 'jack' }]);

        await Promise.all(permutations.map(async perm => {
          const user = await this.User.findByPk(perm, {
            logging(s) {
              expect(s).to.include(0);
              count++;
            }
          });

          expect(user).to.be.null;
        }));

        expect(count).to.be.equal(permutations.length);
      });

      it('should allow us to find IDs using capital letters', async function() {
        const User = this.sequelize.define(`User${Support.rand()}`, {
          ID: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          Login: { type: Sequelize.STRING }
        });

        await User.sync({ force: true });
        await User.create({ Login: 'foo' });
        const user = await User.findByPk(1);
        expect(user).to.exist;
        expect(user.ID).to.equal(1);
      });

      if (['postgres', 'sqlite'].includes(dialect)) {
        it('should allow case-insensitive find on CITEXT type', async function() {
          const User = this.sequelize.define('UserWithCaseInsensitiveName', {
            username: Sequelize.CITEXT
          });

          await User.sync({ force: true });
          await User.create({ username: 'longUserNAME' });
          const user = await User.findOne({ where: { username: 'LONGusername' } });
          expect(user).to.exist;
          expect(user.username).to.equal('longUserNAME');
        });
      }

      if (dialect === 'postgres') {
        it('should allow case-sensitive find on TSVECTOR type', async function() {
          const User = this.sequelize.define('UserWithCaseInsensitiveName', {
            username: Sequelize.TSVECTOR
          });

          await User.sync({ force: true });
          await User.create({ username: 'longUserNAME' });
          const user = await User.findOne({
            where: { username: 'longUserNAME' }
          });
          expect(user).to.exist;
          expect(user.username).to.equal("'longUserNAME'");
        });
      }
    });

    describe('eager loading', () => {
      beforeEach(function() {
        this.Task = this.sequelize.define('Task', { title: Sequelize.STRING });
        this.Worker = this.sequelize.define('Worker', { name: Sequelize.STRING });

        this.init = async function(callback) {
          await this.sequelize.sync({ force: true });
          const worker = await this.Worker.create({ name: 'worker' });
          const task = await this.Task.create({ title: 'homework' });
          this.worker = worker;
          this.task = task;
          return callback();
        };
      });

      describe('belongsTo', () => {
        describe('generic', () => {
          it('throws an error about unexpected input if include contains a non-object', async function() {
            try {
              await this.Worker.findOne({ include: [1] });
            } catch (err) {
              expect(err.message).to.equal('Include unexpected. Element has to be either a Model, an Association or an object.');
            }
          });

          it('throws an error if included DaoFactory is not associated', async function() {
            try {
              await this.Worker.findOne({ include: [this.Task] });
            } catch (err) {
              expect(err.message).to.equal('Task is not associated to Worker!');
            }
          });

          it('returns the associated worker via task.worker', async function() {
            this.Task.belongsTo(this.Worker);

            await this.init(async () => {
              await this.task.setWorker(this.worker);

              const task = await this.Task.findOne({
                where: { title: 'homework' },
                include: [this.Worker]
              });

              expect(task).to.exist;
              expect(task.Worker).to.exist;
              expect(task.Worker.name).to.equal('worker');
            });
          });
        });

        it('returns the private and public ip', async function() {
          const ctx = Object.create(this);
          ctx.Domain = ctx.sequelize.define('Domain', { ip: Sequelize.STRING });
          ctx.Environment = ctx.sequelize.define('Environment', { name: Sequelize.STRING });
          ctx.Environment.belongsTo(ctx.Domain, { as: 'PrivateDomain', foreignKey: 'privateDomainId' });
          ctx.Environment.belongsTo(ctx.Domain, { as: 'PublicDomain', foreignKey: 'publicDomainId' });

          await ctx.Domain.sync({ force: true });
          await ctx.Environment.sync({ force: true });
          const privateIp = await ctx.Domain.create({ ip: '192.168.0.1' });
          const publicIp = await ctx.Domain.create({ ip: '91.65.189.19' });
          const env = await ctx.Environment.create({ name: 'environment' });
          await env.setPrivateDomain(privateIp);
          await env.setPublicDomain(publicIp);

          const environment = await ctx.Environment.findOne({
            where: { name: 'environment' },
            include: [
              { model: ctx.Domain, as: 'PrivateDomain' },
              { model: ctx.Domain, as: 'PublicDomain' }
            ]
          });

          expect(environment).to.exist;
          expect(environment.PrivateDomain).to.exist;
          expect(environment.PrivateDomain.ip).to.equal('192.168.0.1');
          expect(environment.PublicDomain).to.exist;
          expect(environment.PublicDomain.ip).to.equal('91.65.189.19');
        });

        it('eager loads with non-id primary keys', async function() {
          this.User = this.sequelize.define('UserPKeagerbelong', {
            username: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          });
          this.Group = this.sequelize.define('GroupPKeagerbelong', {
            name: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          });
          this.User.belongsTo(this.Group);

          await this.sequelize.sync({ force: true });
          await this.Group.create({ name: 'people' });
          await this.User.create({ username: 'someone', GroupPKeagerbelongName: 'people' });

          const someUser = await this.User.findOne({
            where: {
              username: 'someone'
            },
            include: [this.Group]
          });

          expect(someUser).to.exist;
          expect(someUser.username).to.equal('someone');
          expect(someUser.GroupPKeagerbelong.name).to.equal('people');
        });

        it('getting parent data in many to one relationship', async function() {
          const User = this.sequelize.define('User', {
            id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
            username: { type: Sequelize.STRING }
          });

          const Message = this.sequelize.define('Message', {
            id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
            user_id: { type: Sequelize.INTEGER },
            message: { type: Sequelize.STRING }
          });

          User.hasMany(Message);
          Message.belongsTo(User, { foreignKey: 'user_id' });

          await this.sequelize.sync({ force: true });
          const user = await User.create({ username: 'test_testerson' });
          await Message.create({ user_id: user.id, message: 'hi there!' });
          await Message.create({ user_id: user.id, message: 'a second message' });

          const messages = await Message.findAll({
            where: { user_id: user.id },
            attributes: [
              'user_id',
              'message'
            ],
            include: [{ model: User, attributes: ['username'] }]
          });

          expect(messages.length).to.equal(2);

          expect(messages[0].message).to.equal('hi there!');
          expect(messages[0].User.username).to.equal('test_testerson');

          expect(messages[1].message).to.equal('a second message');
          expect(messages[1].User.username).to.equal('test_testerson');
        });

        it('allows mulitple assocations of the same model with different alias', async function() {
          this.Worker.belongsTo(this.Task, { as: 'ToDo' });
          this.Worker.belongsTo(this.Task, { as: 'DoTo' });

          await this.init(() => {
            return this.Worker.findOne({
              include: [
                { model: this.Task, as: 'ToDo' },
                { model: this.Task, as: 'DoTo' }
              ]
            });
          });
        });
      });

      describe('hasOne', () => {
        beforeEach(async function() {
          this.Worker.hasOne(this.Task);

          await this.init(() => {
            return this.worker.setTask(this.task);
          });
        });

        it('throws an error if included DaoFactory is not associated', async function() {
          try {
            await this.Task.findOne({ include: [this.Worker] });
          } catch (err) {
            expect(err.message).to.equal('Worker is not associated to Task!');
          }
        });

        it('returns the associated task via worker.task', async function() {
          const worker = await this.Worker.findOne({
            where: { name: 'worker' },
            include: [this.Task]
          });

          expect(worker).to.exist;
          expect(worker.Task).to.exist;
          expect(worker.Task.title).to.equal('homework');
        });

        it('eager loads with non-id primary keys', async function() {
          this.User = this.sequelize.define('UserPKeagerone', {
            username: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          });
          this.Group = this.sequelize.define('GroupPKeagerone', {
            name: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          });
          this.Group.hasOne(this.User);

          await this.sequelize.sync({ force: true });
          await this.Group.create({ name: 'people' });
          await this.User.create({ username: 'someone', GroupPKeageroneName: 'people' });

          const someGroup = await this.Group.findOne({
            where: {
              name: 'people'
            },
            include: [this.User]
          });

          expect(someGroup).to.exist;
          expect(someGroup.name).to.equal('people');
          expect(someGroup.UserPKeagerone.username).to.equal('someone');
        });
      });

      describe('hasOne with alias', () => {
        it('throws an error if included DaoFactory is not referenced by alias', async function() {
          try {
            await this.Worker.findOne({ include: [this.Task] });
          } catch (err) {
            expect(err.message).to.equal('Task is not associated to Worker!');
          }
        });

        describe('alias', () => {
          beforeEach(async function() {
            this.Worker.hasOne(this.Task, { as: 'ToDo' });

            await this.init(() => {
              return this.worker.setToDo(this.task);
            });
          });

          it('throws an error indicating an incorrect alias was entered if an association and alias exist but the alias doesn\'t match', async function() {
            try {
              await this.Worker.findOne({ include: [{ model: this.Task, as: 'Work' }] });
            } catch (err) {
              expect(err.message).to.equal('Task is associated to Worker using an alias. You\'ve included an alias (Work), but it does not match the alias(es) defined in your association (ToDo).');
            }
          });

          it('returns the associated task via worker.task', async function() {
            const worker = await this.Worker.findOne({
              where: { name: 'worker' },
              include: [{ model: this.Task, as: 'ToDo' }]
            });

            expect(worker).to.exist;
            expect(worker.ToDo).to.exist;
            expect(worker.ToDo.title).to.equal('homework');
          });

          it('returns the associated task via worker.task when daoFactory is aliased with model', async function() {
            const worker = await this.Worker.findOne({
              where: { name: 'worker' },
              include: [{ model: this.Task, as: 'ToDo' }]
            });

            expect(worker.ToDo.title).to.equal('homework');
          });

          it('allows mulitple assocations of the same model with different alias', async function() {
            this.Worker.hasOne(this.Task, { as: 'DoTo' });

            await this.init(() => {
              return this.Worker.findOne({
                include: [
                  { model: this.Task, as: 'ToDo' },
                  { model: this.Task, as: 'DoTo' }
                ]
              });
            });
          });
        });
      });

      describe('hasMany', () => {
        beforeEach(async function() {
          this.Worker.hasMany(this.Task);

          await this.init(() => {
            return this.worker.setTasks([this.task]);
          });
        });

        it('throws an error if included DaoFactory is not associated', async function() {
          try {
            await this.Task.findOne({ include: [this.Worker] });
          } catch (err) {
            expect(err.message).to.equal('Worker is not associated to Task!');
          }
        });

        it('returns the associated tasks via worker.tasks', async function() {
          const worker = await this.Worker.findOne({
            where: { name: 'worker' },
            include: [this.Task]
          });

          expect(worker).to.exist;
          expect(worker.Tasks).to.exist;
          expect(worker.Tasks[0].title).to.equal('homework');
        });

        it('including two has many relations should not result in duplicate values', async function() {
          this.Contact = this.sequelize.define('Contact', { name: DataTypes.STRING });
          this.Photo = this.sequelize.define('Photo', { img: DataTypes.TEXT });
          this.PhoneNumber = this.sequelize.define('PhoneNumber', { phone: DataTypes.TEXT });

          this.Contact.hasMany(this.Photo, { as: 'Photos' });
          this.Contact.hasMany(this.PhoneNumber);

          await this.sequelize.sync({ force: true });
          const someContact = await this.Contact.create({ name: 'Boris' });
          const somePhoto = await this.Photo.create({ img: 'img.jpg' });
          const somePhone1 = await this.PhoneNumber.create({ phone: '000000' });
          const somePhone2 = await this.PhoneNumber.create({ phone: '111111' });
          await someContact.setPhotos([somePhoto]);
          await someContact.setPhoneNumbers([somePhone1, somePhone2]);

          const fetchedContact = await this.Contact.findOne({
            where: {
              name: 'Boris'
            },
            include: [this.PhoneNumber, { model: this.Photo, as: 'Photos' }]
          });

          expect(fetchedContact).to.exist;
          expect(fetchedContact.Photos.length).to.equal(1);
          expect(fetchedContact.PhoneNumbers.length).to.equal(2);
        });

        it('eager loads with non-id primary keys', async function() {
          this.User = this.sequelize.define('UserPKeagerone', {
            username: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          });
          this.Group = this.sequelize.define('GroupPKeagerone', {
            name: {
              type: Sequelize.STRING,
              primaryKey: true
            }
          });
          this.Group.belongsToMany(this.User, { through: 'group_user' });
          this.User.belongsToMany(this.Group, { through: 'group_user' });

          await this.sequelize.sync({ force: true });
          const someUser = await this.User.create({ username: 'someone' });
          const someGroup = await this.Group.create({ name: 'people' });
          await someUser.setGroupPKeagerones([someGroup]);

          const someUser0 = await this.User.findOne({
            where: {
              username: 'someone'
            },
            include: [this.Group]
          });

          expect(someUser0).to.exist;
          expect(someUser0.username).to.equal('someone');
          expect(someUser0.GroupPKeagerones[0].name).to.equal('people');
        });
      });

      describe('hasMany with alias', () => {
        it('throws an error if included DaoFactory is not referenced by alias', async function() {
          try {
            await this.Worker.findOne({ include: [this.Task] });
          } catch (err) {
            expect(err.message).to.equal('Task is not associated to Worker!');
          }
        });

        describe('alias', () => {
          beforeEach(async function() {
            this.Worker.hasMany(this.Task, { as: 'ToDos' });

            await this.init(() => {
              return this.worker.setToDos([this.task]);
            });
          });

          it('throws an error indicating an incorrect alias was entered if an association and alias exist but the alias doesn\'t match', async function() {
            try {
              await this.Worker.findOne({ include: [{ model: this.Task, as: 'Work' }] });
            } catch (err) {
              expect(err.message).to.equal('Task is associated to Worker using an alias. You\'ve included an alias (Work), but it does not match the alias(es) defined in your association (ToDos).');
            }
          });

          it('returns the associated task via worker.task', async function() {
            const worker = await this.Worker.findOne({
              where: { name: 'worker' },
              include: [{ model: this.Task, as: 'ToDos' }]
            });

            expect(worker).to.exist;
            expect(worker.ToDos).to.exist;
            expect(worker.ToDos[0].title).to.equal('homework');
          });

          it('returns the associated task via worker.task when daoFactory is aliased with model', async function() {
            const worker = await this.Worker.findOne({
              where: { name: 'worker' },
              include: [{ model: this.Task, as: 'ToDos' }]
            });

            expect(worker.ToDos[0].title).to.equal('homework');
          });

          it('allows mulitple assocations of the same model with different alias', async function() {
            this.Worker.hasMany(this.Task, { as: 'DoTos' });

            await this.init(() => {
              return this.Worker.findOne({
                include: [
                  { model: this.Task, as: 'ToDos' },
                  { model: this.Task, as: 'DoTos' }
                ]
              });
            });
          });
        });
      });

      describe('hasMany (N:M) with alias', () => {
        beforeEach(function() {
          this.Product = this.sequelize.define('Product', { title: Sequelize.STRING });
          this.Tag = this.sequelize.define('Tag', { name: Sequelize.STRING });
        });

        it('returns the associated models when using through as string and alias', async function() {
          this.Product.belongsToMany(this.Tag, { as: 'tags', through: 'product_tag' });
          this.Tag.belongsToMany(this.Product, { as: 'products', through: 'product_tag' });

          await this.sequelize.sync();

          await Promise.all([
            this.Product.bulkCreate([
              { title: 'Chair' },
              { title: 'Desk' },
              { title: 'Handbag' },
              { title: 'Dress' },
              { title: 'Jan' }
            ]),
            this.Tag.bulkCreate([
              { name: 'Furniture' },
              { name: 'Clothing' },
              { name: 'People' }
            ])
          ]);

          const [products, tags] = await Promise.all([
            this.Product.findAll(),
            this.Tag.findAll()
          ]);

          this.products = products;
          this.tags = tags;

          await Promise.all([
            products[0].setTags([tags[0], tags[1]]),
            products[1].addTag(tags[0]),
            products[2].addTag(tags[1]),
            products[3].setTags([tags[1]]),
            products[4].setTags([tags[2]])
          ]);

          await Promise.all([
            (async () => {
              const tag = await this.Tag.findOne({
                where: {
                  id: tags[0].id
                },
                include: [
                  { model: this.Product, as: 'products' }
                ]
              });

              expect(tag).to.exist;
              expect(tag.products.length).to.equal(2);
            })(),
            tags[1].getProducts().then(products => {
              expect(products.length).to.equal(3);
            }),
            (async () => {
              const product = await this.Product.findOne({
                where: {
                  id: products[0].id
                },
                include: [
                  { model: this.Tag, as: 'tags' }
                ]
              });

              expect(product).to.exist;
              expect(product.tags.length).to.equal(2);
            })(),
            products[1].getTags().then(tags => {
              expect(tags.length).to.equal(1);
            })
          ]);
        });

        it('returns the associated models when using through as model and alias', async function() {
          // Exactly the same code as the previous test, just with a through model instance, and promisified
          const ProductTag = this.sequelize.define('product_tag');

          this.Product.belongsToMany(this.Tag, { as: 'tags', through: ProductTag });
          this.Tag.belongsToMany(this.Product, { as: 'products', through: ProductTag });

          await this.sequelize.sync();

          await Promise.all([
            this.Product.bulkCreate([
              { title: 'Chair' },
              { title: 'Desk' },
              { title: 'Handbag' },
              { title: 'Dress' },
              { title: 'Jan' }
            ]),
            this.Tag.bulkCreate([
              { name: 'Furniture' },
              { name: 'Clothing' },
              { name: 'People' }
            ])
          ]);

          const [products, tags] = await Promise.all([
            this.Product.findAll(),
            this.Tag.findAll()
          ]);

          this.products = products;
          this.tags = tags;

          await Promise.all([
            products[0].setTags([tags[0], tags[1]]),
            products[1].addTag(tags[0]),
            products[2].addTag(tags[1]),
            products[3].setTags([tags[1]]),
            products[4].setTags([tags[2]])
          ]);

          await Promise.all([
            expect(this.Tag.findOne({
              where: {
                id: this.tags[0].id
              },
              include: [
                { model: this.Product, as: 'products' }
              ]
            })).to.eventually.have.property('products').to.have.length(2),
            expect(this.Product.findOne({
              where: {
                id: this.products[0].id
              },
              include: [
                { model: this.Tag, as: 'tags' }
              ]
            })).to.eventually.have.property('tags').to.have.length(2),
            expect(this.tags[1].getProducts()).to.eventually.have.length(3),
            expect(this.products[1].getTags()).to.eventually.have.length(1)
          ]);
        });
      });
    });

    describe('queryOptions', () => {
      beforeEach(async function() {
        const user = await this.User.create({ username: 'barfooz' });
        this.user = user;
      });

      it('should return a DAO when queryOptions are not set', async function() {
        const user = await this.User.findOne({ where: { username: 'barfooz' } });
        expect(user).to.be.instanceOf(this.User);
      });

      it('should return a DAO when raw is false', async function() {
        const user = await this.User.findOne({ where: { username: 'barfooz' }, raw: false });
        expect(user).to.be.instanceOf(this.User);
      });

      it('should return raw data when raw is true', async function() {
        const user = await this.User.findOne({ where: { username: 'barfooz' }, raw: true });
        expect(user).to.not.be.instanceOf(this.User);
        expect(user).to.be.instanceOf(Object);
      });
    });

    it('should support logging', async function() {
      const spy = sinon.spy();

      await this.User.findOne({
        where: {},
        logging: spy
      });

      expect(spy.called).to.be.ok;
    });

    describe('rejectOnEmpty mode', () => {
      it('throws error when record not found by findOne', async function() {
        await expect(this.User.findOne({
          where: {
            username: 'ath-kantam-pradakshnami'
          },
          rejectOnEmpty: true
        })).to.eventually.be.rejectedWith(Sequelize.EmptyResultError);
      });

      it('throws error when record not found by findByPk', async function() {
        await expect(this.User.findByPk(4732322332323333232344334354234, {
          rejectOnEmpty: true
        })).to.eventually.be.rejectedWith(Sequelize.EmptyResultError);
      });

      it('throws error when record not found by find', async function() {
        await expect(this.User.findOne({
          where: {
            username: 'some-username-that-is-not-used-anywhere'
          },
          rejectOnEmpty: true
        })).to.eventually.be.rejectedWith(Sequelize.EmptyResultError);
      });

      it('works from model options', async () => {
        const Model = current.define('Test', {
          username: Sequelize.STRING(100)
        }, {
          rejectOnEmpty: true
        });

        await Model.sync({ force: true });

        await expect(Model.findOne({
          where: {
            username: 'some-username-that-is-not-used-anywhere'
          }
        })).to.eventually.be.rejectedWith(Sequelize.EmptyResultError);
      });

      it('override model options', async () => {
        const Model = current.define('Test', {
          username: Sequelize.STRING(100)
        }, {
          rejectOnEmpty: true
        });

        await Model.sync({ force: true });

        await expect(Model.findOne({
          rejectOnEmpty: false,
          where: {
            username: 'some-username-that-is-not-used-anywhere'
          }
        })).to.eventually.be.deep.equal(null);
      });

      it('resolve null when disabled', async () => {
        const Model = current.define('Test', {
          username: Sequelize.STRING(100)
        });

        await Model.sync({ force: true });

        await expect(Model.findOne({
          where: {
            username: 'some-username-that-is-not-used-anywhere-for-sure-this-time'
          }
        })).to.eventually.be.equal(null);
      });
    });
  });
});
