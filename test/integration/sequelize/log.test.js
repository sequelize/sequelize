'use strict';

/* jshint -W030 */
var chai = require('chai')
  , sinonChai = require('sinon-chai')
  , sinon = require('sinon')
  , expect = chai.expect
  , Support = require(__dirname + '/../support');

chai.use(sinonChai);
chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('Sequelize'), function() {
  describe('log', function() {
    beforeEach(function() {
      this.spy = sinon.spy(console, 'log');
    });

    afterEach(function() {
      console.log.restore();
    });

    describe('with disabled logging', function() {
      beforeEach(function() {
        this.sequelize = new Support.Sequelize('db', 'user', 'pw', { logging: false });
      });

      it('does not call the log method of the logger', function() {
        this.sequelize.log();
        expect(this.spy.calledOnce).to.be.false;
      });
    });

    describe('with default logging options', function() {
      beforeEach(function() {
        this.sequelize = new Support.Sequelize('db', 'user', 'pw');
      });

      describe('called with no arguments', function() {
        it('calls the log method', function() {
          this.sequelize.log();
          expect(this.spy.calledOnce).to.be.true;
        });

        it('logs an empty string as info event', function() {
          this.sequelize.log();
          expect(this.spy.calledOnce).to.be.true;
        });
      });

      describe('called with one argument', function() {
        it('logs the passed string as info event', function() {
          this.sequelize.log('my message');
          expect(this.spy.withArgs('my message').calledOnce).to.be.true;
        });
      });

      describe('called with more than two arguments', function() {
        it('passes the arguments to the logger', function() {
          this.sequelize.log('error', 'my message', 1, { a: 1 });
          expect(this.spy.withArgs('error', 'my message', 1, { a: 1 }).calledOnce).to.be.true;
        });
      });
    });

    describe('with a custom function for logging', function() {
      beforeEach(function() {
        this.spy = sinon.spy();
        this.sequelize = new Support.Sequelize('db', 'user', 'pw', { logging: this.spy });
      });

      it('calls the custom logger method', function() {
        this.sequelize.log('om nom');
        expect(this.spy.calledOnce).to.be.true;
      });
    });
  });
});
