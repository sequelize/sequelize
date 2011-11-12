var Utils = require("./utils")

module.exports = (function() {
  var QueryChainer = function(emitters) {
    var self = this

    this.finishedEmits = 0
    this.emitters = []
    this.fails = []
    this.finished = false
    this.wasRunning = false
    this.eventEmitter = null

    emitters = emitters || []
    emitters.forEach(function(emitter) { self.add(emitter) })
  }
  Utils.addEventEmitter(QueryChainer)

  QueryChainer.prototype.add = function(emitter) {
    observeEmitter.call(this, emitter)
    this.emitters.push(emitter)
    return this
  }

  QueryChainer.prototype.run = function() {
    var self = this
    this.eventEmitter = new Utils.CustomEventEmitter(function() {
      self.wasRunning = true
      finish.call(self)
    })
    return this.eventEmitter.run()
  }

  // private

  var observeEmitter = function(emitter) {
    var self = this
    emitter
      .on('success', function(){
        self.finishedEmits++
        finish.call(self)
      })
      .on('failure', function(err){
        self.finishedEmits++
        self.fails.push(err)
        finish.call(self)
      })
  }

  var finish = function(result) {
    this.finished = (this.finishedEmits == this.emitters.length)
    if(this.finished && this.wasRunning) {
      var status = this.fails.length == 0 ? 'success' : 'failure'
      result = this.fails.length == 0 ? result : this.fails
      this.eventEmitter.emit(status, result)
    }
  }

  return QueryChainer
})()
