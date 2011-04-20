var Utils = require("./utils")

var QueryChainer = module.exports = function(emitters) {
  var self = this

  this.finishedEmits = 0
  this.emitters = []
  this.fails = []
  this.finished = false
  this.runned = false
  this.instance = null
  
  emitters = emitters || []
  emitters.forEach(function(emitter) { self.add(emitter) })
}
Utils.addEventEmitter(QueryChainer)

QueryChainer.prototype.add = function(emitter) {
  this.observeEmitter(emitter)
  this.emitters.push(emitter)
}
QueryChainer.prototype.observeEmitter = function(emitter) {
  var self = this
  emitter
    .on('success', function(){ self.finishedEmits++; self.finish() })
    .on('failure', function(){ self.finishedEmits++; self.fails.push(emitter); self.finish() })
}
QueryChainer.prototype.finish = function(result) {
  this.finished = (this.finishedEmits == this.emitters.length)
  if(this.finished && this.runned) {
    this.instance.emit(this.fails.length == 0 ? 'success' : 'failure', result)
  }
}
QueryChainer.prototype.run = function() {
  var self = this
  this.instance = new Utils.CustomEventEmitter(function() {
    self.runned = true
    self.finish()
  })
  return this.instance
}