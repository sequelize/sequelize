'use strict';

const { expect } = require('chai');
const { stub, spy } = require('sinon');
const Support = require('../support');
const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Sequelize'), () => {
  describe('log', () => {
    beforeEach(function() {
      this.stub = stub(console, 'log');
    });

    afterEach(() => {
      console.log.restore();
    });

    describe('with disabled logging', () => {
      beforeEach(function() {
        this.sequelize = new Support.Sequelize('db', 'user', 'pw', { dialect, logging: false });
      });

      it('does not call the log method of the logger', function() {
        this.sequelize.log();
        expect(this.stub.calledOnce).to.be.false;
      });
    });

    describe('with default logging options', () => {
      beforeEach(function() {
        this.sequelize = new Support.Sequelize('db', 'user', 'pw', { dialect });
      });

      describe('called with no arguments', () => {
        it('calls the log method', function() {
          this.sequelize.log();
          expect(this.stub.calledOnce).to.be.true;
        });

        it('logs an empty string as info event', function() {
          this.sequelize.log('');
          expect(this.stub.calledOnce).to.be.true;
        });
      });

      describe('called with one argument', () => {
        it('logs the passed string as info event', function() {
          this.sequelize.log('my message');
          expect(this.stub.withArgs('my message').calledOnce).to.be.true;
        });
      });

      describe('called with more than two arguments', () => {
        it('passes the arguments to the logger', function() {
          this.sequelize.log('error', 'my message', 1, { a: 1 });
          expect(this.stub.withArgs('error', 'my message', 1, { a: 1 }).calledOnce).to.be.true;
        });
      });
    });

    describe('with a custom function for logging', () => {
      beforeEach(function() {
        this.spy = spy();
        this.sequelize = new Support.Sequelize('db', 'user', 'pw', { dialect, logging: this.spy });
      });

      it('calls the custom logger method', function() {
        this.sequelize.log('om nom');
        expect(this.spy.calledOnce).to.be.true;
      });

      it('calls the custom logger method with options', function() {
        const message = 'om nom';
        const timeTaken = 5;
        const options = { correlationId: 'ABC001' };
        this.sequelize.log(message, timeTaken, options);
        expect(this.spy.withArgs(message, timeTaken, options).calledOnce).to.be.true;
      });

    });
  });
});
