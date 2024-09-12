'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  Sequelize = require('sequelize'),
  DataTypes = require('sequelize/lib/data-types'),
  _ = require('lodash');

describe(Support.getTestDialectTeaser('Include'), () => {
  describe('findOne', () => {
    it('should include a non required model, with conditions and two includes N:M 1:M', async function() {
      const A = this.sequelize.define('A', { name: DataTypes.STRING(40) }, { paranoid: true }),
        B = this.sequelize.define('B', { name: DataTypes.STRING(40) }, { paranoid: true }),
        C = this.sequelize.define('C', { name: DataTypes.STRING(40) }, { paranoid: true }),
        D = this.sequelize.define('D', { name: DataTypes.STRING(40) }, { paranoid: true });

      // Associations
      A.hasMany(B);

      B.belongsTo(D);
      B.belongsToMany(C, {
        through: 'BC'
      });

      C.belongsToMany(B, {
        through: 'BC'
      });

      D.hasMany(B);

      await this.sequelize.sync({ force: true });

      await A.findOne({
        include: [
          { model: B, required: false, include: [
            { model: C, required: false },
            { model: D }
          ] }
        ]
      });
    });

    it('should work with a 1:M to M:1 relation with a where on the last include', async function() {
      const Model = this.sequelize.define('Model', {});
      const Model2 = this.sequelize.define('Model2', {});
      const Model4 = this.sequelize.define('Model4', { something: { type: DataTypes.INTEGER } });

      Model.belongsTo(Model2);
      Model2.hasMany(Model);

      Model2.hasMany(Model4);
      Model4.belongsTo(Model2);

      await this.sequelize.sync({ force: true });

      await Model.findOne({
        include: [
          { model: Model2, include: [
            { model: Model4, where: { something: 2 } }
          ] }
        ]
      });
    });

    it('should include a model with a where condition but no required', async function() {
      const User = this.sequelize.define('User', {}, { paranoid: false }),
        Task = this.sequelize.define('Task', {
          deletedAt: {
            type: DataTypes.DATE
          }
        }, { paranoid: false });

      User.hasMany(Task, { foreignKey: 'userId' });
      Task.belongsTo(User, { foreignKey: 'userId' });

      await this.sequelize.sync({
        force: true
      });

      const user0 = await User.create();

      await Task.bulkCreate([
        { userId: user0.get('id'), deletedAt: new Date() },
        { userId: user0.get('id'), deletedAt: new Date() },
        { userId: user0.get('id'), deletedAt: new Date() }
      ]);

      const user = await User.findOne({
        include: [
          { model: Task, where: { deletedAt: null }, required: false }
        ]
      });

      expect(user).to.be.ok;
      expect(user.Tasks.length).to.equal(0);
    });

    it('should include a model with a where clause when the PK field name and attribute name are different', async function() {
      const User = this.sequelize.define('User', {
          id: {
            type: DataTypes.UUID,
            defaultValue: Sequelize.UUIDV4,
            field: 'main_id',
            primaryKey: true
          }
        }),
        Task = this.sequelize.define('Task', {
          searchString: { type: DataTypes.STRING }
        });

      User.hasMany(Task, { foreignKey: 'userId' });
      Task.belongsTo(User, { foreignKey: 'userId' });

      await this.sequelize.sync({
        force: true
      });

      const user0 = await User.create();

      await Task.bulkCreate([
        { userId: user0.get('id'), searchString: 'one' },
        { userId: user0.get('id'), searchString: 'two' }
      ]);

      const user = await User.findOne({
        include: [
          { model: Task, where: { searchString: 'one' } }
        ]
      });

      expect(user).to.be.ok;
      expect(user.Tasks.length).to.equal(1);
    });

    it('should include a model with a through.where and required true clause when the PK field name and attribute name are different', async function() {
      const A = this.sequelize.define('a', {}),
        B = this.sequelize.define('b', {}),
        AB = this.sequelize.define('a_b', {
          name: {
            type: DataTypes.STRING(40),
            field: 'name_id',
            primaryKey: true
          }
        });

      A.belongsToMany(B, { through: AB });
      B.belongsToMany(A, { through: AB });

      await this.sequelize
        .sync({ force: true });

      const [a0, b] = await Promise.all([A.create({}), B.create({})]);
      await a0.addB(b, { through: { name: 'Foobar' } });

      const a = await A.findOne({
        include: [
          { model: B, through: { where: { name: 'Foobar' } }, required: true }
        ]
      });

      expect(a).to.not.equal(null);
      expect(a.get('bs')).to.have.length(1);
    });


    it('should still pull the main record when an included model is not required and has where restrictions without matches', async function() {
      const A = this.sequelize.define('a', {
          name: DataTypes.STRING(40)
        }),
        B = this.sequelize.define('b', {
          name: DataTypes.STRING(40)
        });

      A.belongsToMany(B, { through: 'a_b' });
      B.belongsToMany(A, { through: 'a_b' });

      await this.sequelize
        .sync({ force: true });

      await A.create({
        name: 'Foobar'
      });

      const a = await A.findOne({
        where: { name: 'Foobar' },
        include: [
          { model: B, where: { name: 'idontexist' }, required: false }
        ]
      });

      expect(a).to.not.equal(null);
      expect(a.get('bs')).to.deep.equal([]);
    });

    it('should support a nested include (with a where)', async function() {
      const A = this.sequelize.define('A', {
        name: DataTypes.STRING
      });

      const B = this.sequelize.define('B', {
        flag: DataTypes.BOOLEAN
      });

      const C = this.sequelize.define('C', {
        name: DataTypes.STRING
      });

      A.hasOne(B);
      B.belongsTo(A);

      B.hasMany(C);
      C.belongsTo(B);

      await this.sequelize
        .sync({ force: true });

      const a = await A.findOne({
        include: [
          {
            model: B,
            where: { flag: true },
            include: [
              {
                model: C
              }
            ]
          }
        ]
      });

      expect(a).to.not.exist;
    });

    it('should support a belongsTo with the targetKey option', async function() {
      const User = this.sequelize.define('User', { username: { type: DataTypes.STRING, unique: true } }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });
      User.removeAttribute('id');
      Task.belongsTo(User, { foreignKey: 'user_name', targetKey: 'username' });

      await this.sequelize.sync({ force: true });
      const newUser = await User.create({ username: 'bob' });
      const newTask = await Task.create({ title: 'some task' });
      await newTask.setUser(newUser);

      const foundTask = await Task.findOne({
        where: { title: 'some task' },
        include: [{ model: User }]
      });

      expect(foundTask).to.be.ok;
      expect(foundTask.User.username).to.equal('bob');
    });

    it('should support many levels of belongsTo (with a lower level having a where)', async function() {
      const A = this.sequelize.define('a', {}),
        B = this.sequelize.define('b', {}),
        C = this.sequelize.define('c', {}),
        D = this.sequelize.define('d', {}),
        E = this.sequelize.define('e', {}),
        F = this.sequelize.define('f', {}),
        G = this.sequelize.define('g', {
          name: DataTypes.STRING
        }),
        H = this.sequelize.define('h', {
          name: DataTypes.STRING
        });

      A.belongsTo(B);
      B.belongsTo(C);
      C.belongsTo(D);
      D.belongsTo(E);
      E.belongsTo(F);
      F.belongsTo(G);
      G.belongsTo(H);

      await this.sequelize.sync({ force: true });

      const [a0, b] = await Promise.all([A.create({}), (function(singles) {
        let promise = Promise.resolve(),
          previousInstance,
          b;

        singles.forEach(model => {
          const values = {};

          if (model.name === 'g') {
            values.name = 'yolo';
          }

          promise = (async () => {
            await promise;
            const instance = await model.create(values);
            if (previousInstance) {
              await previousInstance[`set${_.upperFirst(model.name)}`](instance);
              previousInstance = instance;
              return;
            }
            previousInstance = b = instance;
          })();
        });

        promise = promise.then(() => {
          return b;
        });

        return promise;
      })([B, C, D, E, F, G, H])]);

      await a0.setB(b);

      const a = await A.findOne({
        include: [
          { model: B, include: [
            { model: C, include: [
              { model: D, include: [
                { model: E, include: [
                  { model: F, include: [
                    { model: G, where: {
                      name: 'yolo'
                    }, include: [
                      { model: H }
                    ] }
                  ] }
                ] }
              ] }
            ] }
          ] }
        ]
      });

      expect(a.b.c.d.e.f.g.h).to.be.ok;
    });

    it('should work with combinding a where and a scope', async function() {
      const User = this.sequelize.define('User', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: DataTypes.STRING
      }, { underscored: true });

      const Post = this.sequelize.define('Post', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, unique: true },
        owner_id: { type: DataTypes.INTEGER, unique: 'combiIndex' },
        owner_type: { type: DataTypes.ENUM, values: ['user', 'org'], defaultValue: 'user', unique: 'combiIndex' },
        'private': { type: DataTypes.BOOLEAN, defaultValue: false }
      }, { underscored: true });

      User.hasMany(Post, { foreignKey: 'owner_id', scope: { owner_type: 'user'  }, as: 'UserPosts', constraints: false });
      Post.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner', constraints: false });

      await this.sequelize.sync({ force: true });

      await User.findOne({
        where: { id: 2 },
        include: [
          { model: Post, as: 'UserPosts', where: { 'private': true } }
        ]
      });
    });
  });
});
