if(typeof require === 'function') {
  const buster             = require("buster")
      , CustomEventEmitter = require("../../lib/emitters/custom-event-emitter")
      , Helpers            = require('../buster-helpers')
      , dialect            = Helpers.getTestDialect()
}

buster.spec.expose()
buster.testRunner.timeout = 1000

describe(Helpers.getTestDialectTeaser("CustomEventEmitter"), function() {
	describe("proxy", function () {
		/* Tests could _probably_ be run synchronously, but for future proofing we're basing it on the events */

		it("should correctly work with success listeners", function (done) {
			var emitter = new CustomEventEmitter()
				, proxy = new CustomEventEmitter()
				, success = this.spy()

			emitter.success(success)
			proxy.success(function () {
				process.nextTick(function () {
					expect(success.called).toEqual(true)
					done();
				})
			})

			proxy.proxy(emitter)
			proxy.emit('success')
		})

		it("should correctly work with error listeners", function (done) {
			var emitter = new CustomEventEmitter()
				, proxy = new CustomEventEmitter()
				, error = this.spy()

			emitter.error(error)
			proxy.error(function () {
				process.nextTick(function () {
					expect(error.called).toEqual(true)
					done();
				})
			})

			proxy.proxy(emitter)
			proxy.emit('error')
		})

		it("should correctly work with complete/done listeners", function (done) {
			var emitter = new CustomEventEmitter()
				, proxy = new CustomEventEmitter()
				, complete = this.spy()

			emitter.complete(complete)
			proxy.complete(function () {
				process.nextTick(function () {
					expect(complete.called).toEqual(true)
					done();
				})
			})

			proxy.proxy(emitter)
			proxy.emit('success')
		})
	});
});