'use strict';

/* jshint -W030 */
var chai = require('chai')
  , sinon = require('sinon')
  , expect = chai.expect
  , stub = sinon.stub
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , current   = Support.sequelize
  , Promise   = current.Promise;

describe(Support.getTestDialectTeaser('belongsToMany'), function() {
  describe('optimizations using bulk create, destroy and update', function() {
    var User = current.define('User', { username: DataTypes.STRING })
      , Task = current.define('Task', { title: DataTypes.STRING })
      , UserTasks = current.define('UserTasks', {});

    User.belongsToMany(Task, { through: UserTasks });
    Task.belongsToMany(User, { through: UserTasks });

    var user = User.build({
      id: 42
    }),
    task1 = Task.build({
      id: 15
    }),
    task2 = Task.build({
      id: 16
    });

    beforeEach(function () {
      this.findAll = stub(UserTasks, 'findAll').returns(Promise.resolve([]));
      this.bulkCreate = stub(UserTasks, 'bulkCreate').returns(Promise.resolve([]));
      this.destroy = stub(UserTasks, 'destroy').returns(Promise.resolve([]));
    });

    afterEach(function () {
      this.findAll.restore();
      this.bulkCreate.restore();
      this.destroy.restore();
    });

    it('uses one insert into statement', function() {
      return user.setTasks([task1, task2]).bind(this).then(function () {
        expect(this.findAll).to.have.been.calledOnce;
        expect(this.bulkCreate).to.have.been.calledOnce;
      });
    });

    it('uses one delete from statement', function() {
      this.findAll
        .onFirstCall().returns(Promise.resolve([]))
        .onSecondCall().returns(Promise.resolve([
          { userId: 42, taskId: 15 },
          { userId: 42, taskId: 16 }
        ]));

      return user.setTasks([task1, task2]).bind(this).then(function () {
        return user.setTasks(null);
      }).then(function () {
        expect(this.findAll).to.have.been.calledTwice;
        expect(this.destroy).to.have.been.calledOnce;
      });
    });
  });

  describe('foreign keys', function() {
    it('should infer otherKey from paired BTM relationship with a through string defined', function () {
      var User = this.sequelize.define('User', {});
      var Place = this.sequelize.define('Place', {});

      var Places = User.belongsToMany(Place, { through: 'user_places', foreignKey: 'user_id' });
      var Users = Place.belongsToMany(User, { through: 'user_places', foreignKey: 'place_id' });

      expect(Places.paired).to.equal(Users);
      expect(Users.paired).to.equal(Places);

      expect(Places.foreignKey).to.equal('user_id');
      expect(Users.foreignKey).to.equal('place_id');

      expect(Places.otherKey).to.equal('place_id');
      expect(Users.otherKey).to.equal('user_id');
    });

    it('should infer otherKey from paired BTM relationship with a through model defined', function () {
      var User = this.sequelize.define('User', {});
      var Place = this.sequelize.define('User', {});
      var UserPlace = this.sequelize.define('UserPlace', {
        id: {
          primaryKey: true,
          type: DataTypes.INTEGER,
          autoIncrement: true
        }
      }, {timestamps: false});

      var Places = User.belongsToMany(Place, { through: UserPlace, foreignKey: 'user_id' });
      var Users = Place.belongsToMany(User, { through: UserPlace, foreignKey: 'place_id' });

      expect(Places.paired).to.equal(Users);
      expect(Users.paired).to.equal(Places);

      expect(Places.foreignKey).to.equal('user_id');
      expect(Users.foreignKey).to.equal('place_id');

      expect(Places.otherKey).to.equal('place_id');
      expect(Users.otherKey).to.equal('user_id');

      expect(Object.keys(UserPlace.rawAttributes).length).to.equal(3); // Defined primary key and two foreign keys
    });
  });

  describe('self-associations', function () {
    it('does not pair multiple self associations with different through arguments', function () {
      var User = current.define('user', {})
        , UserFollowers = current.define('userFollowers', {})
        , Invite = current.define('invite', {});

      User.Followers = User.belongsToMany(User, {
        through: UserFollowers
      });

      User.Invites = User.belongsToMany(User, {
        foreignKey: 'InviteeId',
        through: Invite
      });

      expect(User.Followers.paired).not.to.be.ok;
      expect(User.Invites.paired).not.to.be.ok;

      expect(User.Followers.otherKey).not.to.equal(User.Invites.foreignKey);
    });

    it('works with singular and plural name for self-associations', function () {
      // Models taken from https://github.com/sequelize/sequelize/issues/3796
      var Service = current.define('service', {})
        , Instance = Service.Instance;

      Service.belongsToMany(Service, {through: 'Supplements', as: 'supplements'});
      Service.belongsToMany(Service, {through: 'Supplements', as: {singular: 'supplemented', plural: 'supplemented'}});

      expect(Instance.prototype).to.have.property('getSupplements').which.is.a.function;

      expect(Instance.prototype).to.have.property('addSupplement').which.is.a.function;
      expect(Instance.prototype).to.have.property('addSupplements').which.is.a.function;

      expect(Instance.prototype).to.have.property('getSupplemented').which.is.a.function;
      expect(Instance.prototype).not.to.have.property('getSupplementeds').which.is.a.function;

      expect(Instance.prototype).to.have.property('addSupplemented').which.is.a.function;
      expect(Instance.prototype).not.to.have.property('addSupplementeds').which.is.a.function;
    });
  });
});
