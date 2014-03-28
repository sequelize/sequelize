var chai      = require('chai')
  , sinonChai = require("sinon-chai")
  , sinon     = require('sinon')
  , winston   = require('winston')
  , fs        = require('fs')
  , path      = require('path')
  , expect    = chai.expect
  , assert    = chai.assert
  , Support   = require(__dirname + '/../support')

chai.use(sinonChai)
chai.config.includeStack = true

describe(Support.getTestDialectTeaser("Sequelize"), function () {
  describe('log', function() {
    describe("with disabled logging", function() {
      beforeEach(function() {
        this.sequelize  = new Support.Sequelize('db', 'user', 'pw', { logging: false })
        this.loggerMock = sinon.mock(this.sequelize.logger)
      })

      afterEach(function() {
        this.loggerMock.verify()
      })

      it("does not call the log method of the logger", function() {
        this.loggerMock.expects("log").never()
        this.sequelize.log()
      })
    })

    describe('with default logging options', function() {
      beforeEach(function() {
        this.sequelize  = new Support.Sequelize('db', 'user', 'pw')
        this.loggerMock = sinon.mock(this.sequelize.logger)
      })

      afterEach(function() {
        this.loggerMock.verify()
      })

      describe("called with no arguments", function() {
        it('calls the log method', function() {
          this.loggerMock.expects("log").once()
          this.sequelize.log()
        })

        it('logs an empty string as info event', function() {
          this.loggerMock.expects("log").withArgs('info', '').once()
          this.sequelize.log()
        })
      })

      describe("called with one argument", function() {
        it('logs the passed string as info event', function() {
          this.loggerMock.expects("log").withArgs('info', 'my message').once()
          this.sequelize.log('my message')
        })
      })

      describe("called with two arguments", function() {
        it("uses the first argument as event name and the second as message", function() {
          this.loggerMock.expects("log").withArgs('error', 'my message')
          this.sequelize.log('error', 'my message')
        })
      })

      describe("called with more than two arguments", function() {
        it("uses the first argument as event name and passes the others to the logger", function() {
          this.loggerMock.expects("log").withArgs('error', 'my message', 1, { a: 1 })
          this.sequelize.log('error', 'my message', 1, { a: 1 })
        })
      })
    })

    describe("with a custom function for logging", function() {
      beforeEach(function() {
        this.spy       = sinon.spy()
        this.sequelize = new Support.Sequelize('db', 'user', 'pw', { logging: this.spy })
      })

      it("calls the custom logger method", function() {
        this.sequelize.log('om nom')
        expect(this.spy.calledOnce).to.be.true
      })
    })

    describe("with custom winston options", function() {
      beforeEach(function() {
        this.logFile   = path.normalize(__dirname + '/../tmp/sequelize.log')

        if (fs.existsSync(this.logFile)) {
          fs.unlinkSync(this.logFile)
        }

        this.spy       = sinon.spy()
        this.sequelize = new Support.Sequelize('db', 'user', 'pw', {
          logging: {
            transports: [
              new winston.transports.File({ filename: this.logFile })
            ]
          }
        })
      })

      afterEach(function() {
       if (fs.existsSync(this.logFile)) {
          fs.unlinkSync(this.logFile)
        }
      })

      it("calls the custom logger method", function(done) {
        var self = this

        expect(fs.existsSync(this.logFile)).to.be.false
        this.sequelize.log('om nom')

        setTimeout(function() {
          expect(fs.existsSync(self.logFile)).to.be.true
          done()
        }, 100)
      })
    })
  })
})
