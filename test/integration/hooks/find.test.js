'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types');

describe(Support.getTestDialectTeaser('Hooks'), function() {
  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      username: {
        type: DataTypes.STRING,
        allowNull: false
      },
      mood: {
        type: DataTypes.ENUM,
        values: ['happy', 'sad', 'neutral']
      }
    });

    return this.sequelize.sync({ force: true });
  });

  describe('#find', function() {
    beforeEach(function() {
      return this.User.bulkCreate([
        {username: 'adam', mood: 'happy'},
        {username: 'joe', mood: 'sad'}
      ]);
    });

    describe('on success', function() {
      it('all hooks run', function() {
        var beforeHook = false
          , beforeHook2 = false
          , beforeHook3 = false
          , afterHook = false;

        this.User.beforeFind(function() {
          beforeHook = true;
        });

        this.User.beforeFindAfterExpandIncludeAll(function() {
          beforeHook2 = true;
        });

        this.User.beforeFindAfterOptions(function() {
          beforeHook3 = true;
        });

        this.User.afterFind(function() {
          afterHook = true;
        });

        return this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('happy');
          expect(beforeHook).to.be.true;
          expect(beforeHook2).to.be.true;
          expect(beforeHook3).to.be.true;
          expect(afterHook).to.be.true;
        });
      });

      it('beforeFind hook can change options', function() {
        this.User.beforeFind(function(options) {
          options.where.username = 'joe';
        });

        return this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('sad');
        });
      });

      it('beforeFindAfterExpandIncludeAll hook can change options', function() {
        this.User.beforeFindAfterExpandIncludeAll(function(options) {
          options.where.username = 'joe';
        });

        return this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('sad');
        });
      });

      it('beforeFindAfterOptions hook can change options', function() {
        this.User.beforeFindAfterOptions(function(options) {
          options.where.username = 'joe';
        });

        return this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('sad');
        });
      });

      it('afterFind hook can change results', function() {
        this.User.afterFind(function(user) {
          user.mood = 'sad';
        });

        return this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('sad');
        });
      });
    });

    describe('on error', function() {
      it('in beforeFind hook returns error', function() {
        this.User.beforeFind(function() {
          throw new Error('Oops!');
        });

        return this.User.find({where: {username: 'adam'}}).catch (function(err) {
          expect(err.message).to.equal('Oops!');
        });
      });

      it('in beforeFindAfterExpandIncludeAll hook returns error', function() {
        this.User.beforeFindAfterExpandIncludeAll(function() {
          throw new Error('Oops!');
        });

        return this.User.find({where: {username: 'adam'}}).catch (function(err) {
          expect(err.message).to.equal('Oops!');
        });
      });

      it('in beforeFindAfterOptions hook returns error', function() {
        this.User.beforeFindAfterOptions(function() {
          throw new Error('Oops!');
        });

        return this.User.find({where: {username: 'adam'}}).catch (function(err) {
          expect(err.message).to.equal('Oops!');
        });
      });

      it('in afterFind hook returns error', function() {
        this.User.afterFind(function() {
          throw new Error('Oops!');
        });

        return this.User.find({where: {username: 'adam'}}).catch (function(err) {
          expect(err.message).to.equal('Oops!');
        });
      });
    });
  });

});
