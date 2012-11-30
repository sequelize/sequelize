if(typeof require === 'function') {
  const buster             = require("buster")
      , QueryChainer       = require("../lib/query-chainer")
      , CustomEventEmitter = require("../lib/emitters/custom-event-emitter")
      , Helpers            = require('./buster-helpers')
      , dialect            = Helpers.getTestDialect()
}

buster.spec.expose()
buster.testRunner.timeout = 1000

describe("[" + Helpers.getTestDialectTeaser() + "] QueryChainer", function() {
  before(function() {
    this.queryChainer = new QueryChainer()
  })

  describe('add', function() {
    it('adds a new serial item if method is passed',   function() {
      expect(this.queryChainer.serials.length).toEqual(0)
      this.queryChainer.add({}, 'foo')
      expect(this.queryChainer.serials.length).toEqual(1)
    })

    it('adds a new emitter if no method is passed', function() {
      expect(this.queryChainer.emitters.length).toEqual(0)
      this.queryChainer.add(new CustomEventEmitter())
      expect(this.queryChainer.emitters.length).toEqual(1)
    })
  })

  describe('run', function() {
    it('finishes when all emitters are finished', function(done) {
      var emitter1 = new CustomEventEmitter(function(e) { e.emit('success') })
      var emitter2 = new CustomEventEmitter(function(e) { e.emit('success') })

      this.queryChainer.add(emitter1)
      this.queryChainer.add(emitter2)

      this.queryChainer.run().success(function() {
        assert(true)
        done()
      }).error(function(err) {
        console.log(err)
      })

      emitter1.run()
      setTimeout(function() { emitter2.run() }, 100)
    })

    it("returns the result of the passed emitters", function(done) {
      var emitter1 = new CustomEventEmitter(function(e) { e.emit('success', 1) })

      this.queryChainer.add(emitter1)

      this.queryChainer.run().success(function(results) {
        expect(results).toBeDefined()
        expect(results.length).toEqual(1)
        expect(results[0]).toEqual(1)
        done()
      })

      emitter1.run()
    })

    it("returns the result of the passed emitters in the order of the occurrence of adding the emitters", function(done) {
      var emitter1 = new CustomEventEmitter(function(e) { e.emit('success', 1) })
        , emitter2 = new CustomEventEmitter(function(e) { e.emit('success', 2) })
        , emitter3 = new CustomEventEmitter(function(e) { e.emit('success', 3) })

      this.queryChainer.add(emitter1)
      this.queryChainer.add(emitter2)
      this.queryChainer.add(emitter3)

      this.queryChainer.run().success(function(results) {
        expect(results.length).toEqual(3)
        expect(results).toEqual([1,2,3])
        done()
      })

      emitter2.run()
      emitter1.run()
      emitter3.run()
    })

    it("returns the result as an array and each result as part of the callback signature", function(done) {
      var emitter1 = new CustomEventEmitter(function(e) { e.emit('success', 1) })
        , emitter2 = new CustomEventEmitter(function(e) { e.emit('success', 2) })

      this.queryChainer.add(emitter1)
      this.queryChainer.add(emitter2)

      this.queryChainer.run().success(function(results, result1, result2) {
        expect(result1).toBeDefined()
        expect(result2).toBeDefined()
        expect(result1).toEqual(1)
        expect(result2).toEqual(2)
        done()
      })

      emitter2.run()
      emitter1.run()
    })
  })

  describe('runSerially', function() {
    it('finishes when all emitters are finished', function(done) {
      var emitter1 = new CustomEventEmitter(function(e) { e.emit('success') })
      var emitter2 = new CustomEventEmitter(function(e) { e.emit('success') })

      this.queryChainer.add(emitter1, 'run')
      this.queryChainer.add(emitter2, 'run')

      this.queryChainer.runSerially().success(function() {
        assert(true)
        done()
      })
    })

    it("returns the result of the passed emitters", function(done) {
      var emitter1 = new CustomEventEmitter(function(e) { e.emit('success', 1) })

      this.queryChainer.add(emitter1, 'run')

      this.queryChainer.runSerially().success(function(results) {
        expect(results).toBeDefined()
        expect(results.length).toEqual(1)
        expect(results[0]).toEqual(1)
        done()
      })
    })

    it("returns the result of the passed emitters in the order of the occurrence of adding the emitters", function(done) {
      var emitter1 = new CustomEventEmitter(function(e) { e.emit('success', 1) })
        , emitter2 = new CustomEventEmitter(function(e) { setTimeout(function() { e.emit('success', 2) }, 100) })
        , emitter3 = new CustomEventEmitter(function(e) { e.emit('success', 3) })

      this.queryChainer.add(emitter1, 'run')
      this.queryChainer.add(emitter2, 'run')
      this.queryChainer.add(emitter3, 'run')

      this.queryChainer.runSerially().success(function(results) {
        expect(results.length).toEqual(3)
        expect(results).toEqual([1,2,3])
        done()
      })
    })

    it("returns the result as an array and each result as part of the callback signature", function(done) {
      var emitter1 = new CustomEventEmitter(function(e) { e.emit('success', 1) })
        , emitter2 = new CustomEventEmitter(function(e) { e.emit('success', 2) })

      this.queryChainer.add(emitter1, 'run')
      this.queryChainer.add(emitter2, 'run')

      this.queryChainer.runSerially().success(function(results, result1, result2) {
        expect(result1).toBeDefined()
        expect(result2).toBeDefined()
        expect(result1).toEqual(1)
        expect(result2).toEqual(2)
        done()
      })
    })
  })
})
