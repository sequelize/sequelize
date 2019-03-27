'use strict';

const { expect } = require('chai');
const { stub, spy, match } = require('sinon');
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
          expect(this.spy.calledOnce).to.be.true;
        });

        it('logs an empty string as info event', function() {
          this.sequelize.log('');
          expect(this.spy.calledOnce).to.be.true;
        });
      });

      describe('called with one argument', () => {
        it('logs the passed string as info event', function() {
          this.sequelize.log('my message');
          expect(this.spy.withArgs('my message').calledOnce).to.be.true;
        });
      });

      describe('called with more than two arguments', () => {
        it('passes the arguments to the logger', function() {
          this.sequelize.log('error', 'my message', 1, { a: 1 });
          expect(this.spy.withArgs('error', 'my message', 1, { a: 1 }).calledOnce).to.be.true;
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

  describe('logQuery', () => {
    beforeEach(function() {
      this.spy = spy();
      this.sequelize = new Support.Sequelize('db', 'user', 'pw', { dialect, logging: this.spy });
    });

    it('logs before and after', function() {
      const debugStub = stub();
      const complete = this.sequelize.logQuery({ uuid: 'test' }, 'SELECT 1', {}, false, { log: debugStub });
      complete();
      expect(this.spy).to.have.been.calledOnce;
      expect(this.spy).to.have.been.calledWithMatch('Executing (test): SELECT 1', {});

      expect(debugStub).to.have.been.calledWith('Executing (test): SELECT 1');
      expect(debugStub).to.have.been.calledWith('Executed (test): SELECT 1');
    });

    it('logs before and after with benchmark', function() {
      const debugStub = stub();
      const complete = this.sequelize.logQuery({ uuid: 'test' }, 'SELECT 1', {}, true, { log: debugStub });
      complete();
      expect(this.spy).to.have.been.calledOnce;
      expect(this.spy).to.have.been.calledWithMatch('Executed (test): SELECT 1', match.number, {});

      expect(debugStub).to.have.been.calledWith('Executing (test): SELECT 1');
      expect(debugStub).to.have.been.calledWith('Executed (test): SELECT 1');
    });
  });
});
