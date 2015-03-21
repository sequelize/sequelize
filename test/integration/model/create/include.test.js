'use strict';

var chai = require('chai')
  , Sequelize = require('../../../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , dialect = Support.getTestDialect()
  , DataTypes = require(__dirname + '/../../../../lib/data-types')
  , Promise = Sequelize.Promise;

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('create', function() {
    describe('include', function() {
      it('should create data for BelongsTo relations', function() {
        var Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        });
        var User = this.sequelize.define('User', {
          first_name: Sequelize.STRING,
          last_name: Sequelize.STRING
        });

        Product.belongsTo(User);

        return this.sequelize.sync({ force: true }).then(function() {
          return Product.create({
            title: 'Chair',
            User: {
              first_name: 'Mick',
              last_name: 'Broadstone'
            }
          }, {
            include: [ User ]
          }).then(function(savedProduct) {
            return Product.findOne({
              where: { id: savedProduct.id },
              include: [ User ]
            }).then(function(persistedProduct) {
              expect(persistedProduct.User).to.be.ok;
              expect(persistedProduct.User.first_name).to.be.equal('Mick');
              expect(persistedProduct.User.last_name).to.be.equal('Broadstone');
            });
          });
        });
      });

      it('should create data for BelongsTo relations with alias', function() {
        var Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        });
        var User = this.sequelize.define('User', {
          first_name: Sequelize.STRING,
          last_name: Sequelize.STRING
        });

        var Creator = Product.belongsTo(User, {as: 'creator'});

        return this.sequelize.sync({ force: true }).then(function() {
          return Product.create({
            title: 'Chair',
            creator: {
              first_name: 'Matt',
              last_name: 'Hansen'
            }
          }, {
            include: [ Creator ]
          }).then(function(savedProduct) {
            return Product.findOne({
              where: { id: savedProduct.id },
              include: [ Creator ]
            }).then(function(persistedProduct) {
              expect(persistedProduct.creator).to.be.ok;
              expect(persistedProduct.creator.first_name).to.be.equal('Matt');
              expect(persistedProduct.creator.last_name).to.be.equal('Hansen');
            });
          });
        });
      });

      it('should create data for HasMany relations', function() {
        var Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        });
        var Tag = this.sequelize.define('Tag', {
          name: Sequelize.STRING
        });

        Product.hasMany(Tag);

        return this.sequelize.sync({ force: true }).then(function() {
          return Product.create({
            id: 1,
            title: 'Chair',
            Tags: [
              {id: 1, name: 'Alpha'},
              {id: 2, name: 'Beta'}
            ]
          }, {
            include: [ Tag ]
          }).then(function(savedProduct) {
            return Product.find({
              where: { id: savedProduct.id },
              include: [ Tag ]
            }).then(function(persistedProduct) {
              expect(persistedProduct.Tags).to.be.ok;
              expect(persistedProduct.Tags.length).to.equal(2);
            });
          });
        });
      });

      it('should create data for HasMany relations with alias', function() {
        var Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        });
        var Tag = this.sequelize.define('Tag', {
          name: Sequelize.STRING
        });

        var Categories = Product.hasMany(Tag, {as: 'categories'});

        return this.sequelize.sync({ force: true }).then(function() {
          return Product.create({
            id: 1,
            title: 'Chair',
            categories: [
              {id: 1, name: 'Alpha'},
              {id: 2, name: 'Beta'}
            ]
          }, {
            include: [ Categories ]
          }).then(function(savedProduct) {
            return Product.find({
              where: { id: savedProduct.id },
              include: [ Categories ]
            }).then(function(persistedProduct) {
              expect(persistedProduct.categories).to.be.ok;
              expect(persistedProduct.categories.length).to.equal(2);
            });
          });
        });
      });

      it('should create data for HasOne relations', function() {
        var User = this.sequelize.define('User', {
          username: Sequelize.STRING
        });

        var Task = this.sequelize.define('Task', {
          title: Sequelize.STRING
        });

        User.hasOne(Task);

        return this.sequelize.sync({ force: true }).then(function() {
          return User.create({
            username: 'Muzzy',
            Task: {
              title: 'Eat Clocks'
            }
          }, {
            include: [ Task ]
          }).then(function(savedUser) {
            return User.find({
              where: { id: savedUser.id },
              include: [ Task ]
            }).then(function(persistedUser) {
              expect(persistedUser.Task).to.be.ok;
            });
          });
        });
      });

      it('should create data for HasOne relations with alias', function() {
        var User = this.sequelize.define('User', {
          username: Sequelize.STRING
        });

        var Task = this.sequelize.define('Task', {
          title: Sequelize.STRING
        });

        var Job = User.hasOne(Task, {as: 'job'});



        return this.sequelize.sync({ force: true }).then(function() {
          return User.create({
            username: 'Muzzy',
            job: {
              title: 'Eat Clocks'
            }
          }, {
            include: [ Job ]
          }).then(function(savedUser) {
            return User.find({
              where: { id: savedUser.id },
              include: [ Job ]
            }).then(function(persistedUser) {
              expect(persistedUser.job).to.be.ok;
            });
          });
        });
      });

      it('should create data for BelongsToMany relations', function() {
        var User = this.sequelize.define('User', {
          username: DataTypes.STRING
        });

        var Task = this.sequelize.define('Task', {
          title: DataTypes.STRING,
          active: DataTypes.BOOLEAN
        });

        User.belongsToMany(Task, {through: 'user_task'});
        Task.belongsToMany(User, {through: 'user_task'});

        return this.sequelize.sync({ force: true }).then(function() {
          return User.create({
            username: 'John',
            Tasks: [
              { title: 'Get rich', active: true },
              { title: 'Die trying', active: false }
            ]
          }, {
            include: [ Task ]
          }).then(function(savedUser) {
            return User.find({
              where: { id: savedUser.id },
              include: [ Task ]
            }).then(function(persistedUser) {
              expect(persistedUser.Tasks).to.be.ok;
              expect(persistedUser.Tasks.length).to.equal(2);
            });
          });
        });
      });

      it('should create data for BelongsToMany relations with alias', function() {
        var User = this.sequelize.define('User', {
          username: DataTypes.STRING
        });

        var Task = this.sequelize.define('Task', {
          title: DataTypes.STRING,
          active: DataTypes.BOOLEAN
        });

        var Jobs = User.belongsToMany(Task, {through: 'user_job', as: 'jobs'});
        Task.belongsToMany(User, {through: 'user_job'});

        return this.sequelize.sync({ force: true }).then(function() {
          return User.create({
            username: 'John',
            jobs: [
              { title: 'Get rich', active: true },
              { title: 'Die trying', active: false }
            ]
          }, {
            include: [ Jobs ]
          }).then(function(savedUser) {
            return User.find({
              where: { id: savedUser.id },
              include: [ Jobs ]
            }).then(function(persistedUser) {
              expect(persistedUser.jobs).to.be.ok;
              expect(persistedUser.jobs.length).to.equal(2);
            });
          });
        });
      });
    });
  });
});
