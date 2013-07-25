/* jshint camelcase: false */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , sinon     = require('sinon')
  , CustomEventEmitter = require("../../lib/emitters/custom-event-emitter")

chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("CustomEventEmitter"), function () {
  describe("proxy", function () {
    it("should correctly work with success listeners", function(done) {
      var emitter = new CustomEventEmitter()
        , proxy = new CustomEventEmitter()
        , success = sinon.spy()

      emitter.success(success)
      proxy.success(function () {
        process.nextTick(function () {
          expect(success.called).to.be.true
          done()
        })
      })

      proxy.proxy(emitter)
      proxy.emit('success')
    })

    it("should correctly work with error listeners", function(done) {
      var emitter = new CustomEventEmitter()
        , proxy = new CustomEventEmitter()
        , error = sinon.spy()

      emitter.error(error)
      proxy.error(function() {
        process.nextTick(function() {
          expect(error.called).to.be.true
          done()
        })
      })

      proxy.proxy(emitter)
      proxy.emit('error')
    })

    it("should correctly work with complete/done listeners", function(done) {
      var emitter = new CustomEventEmitter()
        , proxy = new CustomEventEmitter()
        , complete = sinon.spy()

      emitter.complete(complete)
      proxy.complete(function() {
        process.nextTick(function() {
          expect(complete.called).to.be.true
          done()
        })
      })

      proxy.proxy(emitter)
      proxy.emit('success')
    })
  })
})
