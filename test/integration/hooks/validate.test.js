'use strict';

const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;
const Support = require('../support');
const DataTypes = require('sequelize/lib/data-types');

describe(Support.getTestDialectTeaser('Hooks'), () => {
  beforeEach(async function() {
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
    await this.sequelize.sync({ force: true });
  });

  describe('#validate', () => {
    describe('#create', () => {
      it('should return the user', async function() {
        this.User.beforeValidate(user => {
          user.username = 'Bob';
          user.mood = 'happy';
        });

        this.User.afterValidate(user => {
          user.username = 'Toni';
        });

        const user = await this.User.create({ mood: 'ecstatic' });
        expect(user.mood).to.equal('happy');
        expect(user.username).to.equal('Toni');
      });
    });

    describe('#3534, hooks modifications', () => {
      it('fields modified in hooks are saved', async function() {
        this.User.afterValidate(user => {
          //if username is defined and has more than 5 char
          user.username = user.username
            ? user.username.length < 5 ? null : user.username
            : null;
          user.username = user.username || 'Samorost 3';

        });

        this.User.beforeValidate(user => {
          user.mood = user.mood || 'neutral';
        });


        const user = await this.User.create({ username: 'T', mood: 'neutral' });
        expect(user.mood).to.equal('neutral');
        expect(user.username).to.equal('Samorost 3');

        //change attributes
        user.mood = 'sad';
        user.username = 'Samorost Good One';

        const uSaved0 = await user.save();
        expect(uSaved0.mood).to.equal('sad');
        expect(uSaved0.username).to.equal('Samorost Good One');

        //change attributes, expect to be replaced by hooks
        uSaved0.username = 'One';

        const uSaved = await uSaved0.save();
        //attributes were replaced by hooks ?
        expect(uSaved.mood).to.equal('sad');
        expect(uSaved.username).to.equal('Samorost 3');
        const uFetched0 = await this.User.findByPk(uSaved.id);
        expect(uFetched0.mood).to.equal('sad');
        expect(uFetched0.username).to.equal('Samorost 3');

        uFetched0.mood = null;
        uFetched0.username = 'New Game is Needed';

        const uFetchedSaved0 = await uFetched0.save();
        expect(uFetchedSaved0.mood).to.equal('neutral');
        expect(uFetchedSaved0.username).to.equal('New Game is Needed');

        const uFetched = await this.User.findByPk(uFetchedSaved0.id);
        expect(uFetched.mood).to.equal('neutral');
        expect(uFetched.username).to.equal('New Game is Needed');

        //expect to be replaced by hooks
        uFetched.username = 'New';
        uFetched.mood = 'happy';
        const uFetchedSaved = await uFetched.save();
        expect(uFetchedSaved.mood).to.equal('happy');
        expect(uFetchedSaved.username).to.equal('Samorost 3');
      });
    });

    describe('on error', () => {
      it('should emit an error from after hook', async function() {
        this.User.afterValidate(user => {
          user.mood = 'ecstatic';
          throw new Error('Whoops! Changed user.mood!');
        });

        await expect(this.User.create({ username: 'Toni', mood: 'happy' })).to.be.rejectedWith('Whoops! Changed user.mood!');
      });

      it('should call validationFailed hook', async function() {
        const validationFailedHook = sinon.spy();

        this.User.validationFailed(validationFailedHook);

        await expect(this.User.create({ mood: 'happy' })).to.be.rejected;
        expect(validationFailedHook).to.have.been.calledOnce;
      });

      it('should not replace the validation error in validationFailed hook by default', async function() {
        const validationFailedHook = sinon.stub();

        this.User.validationFailed(validationFailedHook);

        const err = await expect(this.User.create({ mood: 'happy' })).to.be.rejected;
        expect(err.name).to.equal('SequelizeValidationError');
      });

      it('should replace the validation error if validationFailed hook creates a new error', async function() {
        const validationFailedHook = sinon.stub().throws(new Error('Whoops!'));

        this.User.validationFailed(validationFailedHook);

        const err = await expect(this.User.create({ mood: 'happy' })).to.be.rejected;
        expect(err.message).to.equal('Whoops!');
      });
    });
  });
});
