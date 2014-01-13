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

  describe("when emitting an error event with an array of errors", function() {
    describe("if no error handler is given", function() {
      it("should throw the first error", function(done) {
        var emitter = new CustomEventEmitter()

        expect(function () {
          emitter.emit("error", [
            [
              new Error("First error"),
              new Error("Second error")
            ], [
              new Error("Third error")
            ]
          ])
        }).to.throw("First error")

        done()
      })
    })

    describe("if an error handler is given", function() {
      it("should return the whole array", function(done) {
        var emitter = new CustomEventEmitter()
        var errors = [
          [
            new Error("First error"),
            new Error("Second error")
          ], [
            new Error("Third error")
          ]
        ]

        emitter.error(function (err) {
          expect(err).to.equal(errors)

          done()
        })
        emitter.emit("error", errors)
      })
    })
  })

  describe("when emitting an error event with a hash containing arrays of error strings", function() {
    describe("if no error handler is given", function() {
      it("should throw an error with the first error string", function(done) {
        var emitter = new CustomEventEmitter()
        var errors = {
          myValidation: [ "Invalid Length" ],
          someOtherValidation: [ "Naah don't like that value!", "It's weird, u know?" ]
        }

        expect(function () {
          emitter.emit("error", errors)
        }).to.throw(errors.myValidation[0])

        done()
      })
    })
  })
})
