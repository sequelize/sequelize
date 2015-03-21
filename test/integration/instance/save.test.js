'use strict';

var chai = require('chai')
  , Sequelize = require('../../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , dialect = Support.getTestDialect()
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , Promise = Sequelize.Promise;

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('Instance'), function() {
  describe('save', function() {
    describe('include', function() {
      it('should save data for BelongsTo relations', function() {
        var Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        });
        var User = this.sequelize.define('User', {
          first_name: Sequelize.STRING,
          last_name: Sequelize.STRING
        });

        Product.belongsTo(User);

        var product = Product.build({
          id: 1,
          title: 'Chair',
          User: {
            id: 1,
            first_name: 'Mick',
            last_name: 'Hansen'
          }
        }, {
          include: [ User ]
        });

        return this.sequelize.sync({ force: true }).then(function() {
          return product.save().then(function(savedProduct) {
            return Product.find({
              where: { id: savedProduct.id },
              include: [ User ]
            }).then(function(persistedProduct) {
              expect(persistedProduct.User).to.be.ok;
            });
          });
        });
      });

      it('should save data for HasMany relations', function() {
        var Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        });
        var Tag = this.sequelize.define('Tag', {
          name: Sequelize.STRING
        });

        Product.hasMany(Tag);

        var product = Product.build({
          id: 1,
          title: 'Chair',
          Tags: [
            {id: 1, name: 'Alpha'},
            {id: 2, name: 'Beta'}
          ]
        }, {
          include: [ Tag ]
        });

        return this.sequelize.sync({ force: true }).then(function() {
          return product.save().then(function(savedProduct) {
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

      it('should save data for HasOne relations', function() {
        var User = this.sequelize.define('User', {
          username: Sequelize.STRING
        });

        var Task = this.sequelize.define('Task', {
          title: Sequelize.STRING
        });

        User.hasOne(Task);

        var user = User.build({
          username: 'Muzzy',
          Task: {
            title: 'Eat Clocks'
          }
        }, {
          include: [ Task ]
        });

        return this.sequelize.sync({ force: true }).then(function() {
          return user.save().then(function(savedUser) {
            return User.find({
              where: { id: savedUser.id },
              include: [ Task ]
            }).then(function(persistedUser) {
              expect(persistedUser.Task).to.be.ok;
            });
          });
        });
      });

      it('should save data for BelongsToMany relations', function() {
        var User = this.sequelize.define('User', {
          username: DataTypes.STRING
        });

        var Task = this.sequelize.define('Task', {
          title: DataTypes.STRING,
          active: DataTypes.BOOLEAN
        });

        User.belongsToMany(Task);
        Task.belongsToMany(User);

        var user = User.build({
          username: 'John',
          Tasks: [
            { title: 'Get rich', active: true },
            { title: 'Die trying', active: false }
          ]
        }, {
          include: [ Task ]
        });

        var tasks = [];
        return this.sequelize.sync({ force: true }).then(function() {
          return user.save().then(function(savedUser) {
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

    });
  });
});
