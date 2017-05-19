'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types');

describe(Support.getTestDialectTeaser('Hooks'), () => {
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

  describe('#find', () => {
    beforeEach(function() {
      return this.User.bulkCreate([
        {username: 'adam', mood: 'happy'},
        {username: 'joe', mood: 'sad'}
      ]);
    });

    it('allow changing attributes via beforeFind #5675', function() {
      this.User.beforeFind(options => {
        options.attributes = {
          include: ['id']
        };
      });
      return this.User.findAll({});
    });

    describe('on success', () => {
      it('all hooks run', function() {
        let beforeHook = false,
          beforeHook2 = false,
          beforeHook3 = false,
          afterHook = false;

        this.User.beforeFind(() => {
          beforeHook = true;
        });

        this.User.beforeFindAfterExpandIncludeAll(() => {
          beforeHook2 = true;
        });

        this.User.beforeFindAfterOptions(() => {
          beforeHook3 = true;
        });

        this.User.afterFind(() => {
          afterHook = true;
        });

        return this.User.find({where: {username: 'adam'}}).then(user => {
          expect(user.mood).to.equal('happy');
          expect(beforeHook).to.be.true;
          expect(beforeHook2).to.be.true;
          expect(beforeHook3).to.be.true;
          expect(afterHook).to.be.true;
        });
      });

      it('beforeFind hook can change options', function() {
        this.User.beforeFind(options => {
          options.where.username = 'joe';
        });

        return this.User.find({where: {username: 'adam'}}).then(user => {
          expect(user.mood).to.equal('sad');
        });
      });

      it('beforeFindAfterExpandIncludeAll hook can change options', function() {
        this.User.beforeFindAfterExpandIncludeAll(options => {
          options.where.username = 'joe';
        });

        return this.User.find({where: {username: 'adam'}}).then(user => {
          expect(user.mood).to.equal('sad');
        });
      });

      it('beforeFindAfterOptions hook can change options', function() {
        this.User.beforeFindAfterOptions(options => {
          options.where.username = 'joe';
        });

        return this.User.find({where: {username: 'adam'}}).then(user => {
          expect(user.mood).to.equal('sad');
        });
      });

      it('afterFind hook can change results', function() {
        this.User.afterFind(user => {
          user.mood = 'sad';
        });

        return this.User.find({where: {username: 'adam'}}).then(user => {
          expect(user.mood).to.equal('sad');
        });
      });
    });

    describe('on error', () => {
      it('in beforeFind hook returns error', function() {
        this.User.beforeFind(() => {
          throw new Error('Oops!');
        });

        return this.User.find({where: {username: 'adam'}}).catch (err => {
          expect(err.message).to.equal('Oops!');
        });
      });

      it('in beforeFindAfterExpandIncludeAll hook returns error', function() {
        this.User.beforeFindAfterExpandIncludeAll(() => {
          throw new Error('Oops!');
        });

        return this.User.find({where: {username: 'adam'}}).catch (err => {
          expect(err.message).to.equal('Oops!');
        });
      });

      it('in beforeFindAfterOptions hook returns error', function() {
        this.User.beforeFindAfterOptions(() => {
          throw new Error('Oops!');
        });

        return this.User.find({where: {username: 'adam'}}).catch (err => {
          expect(err.message).to.equal('Oops!');
        });
      });

      it('in afterFind hook returns error', function() {
        this.User.afterFind(() => {
          throw new Error('Oops!');
        });

        return this.User.find({where: {username: 'adam'}}).catch (err => {
          expect(err.message).to.equal('Oops!');
        });
      });
    });
  });

});
