var Utils = require("./utils")

var QueryChainer = module.exports = function(emitters) {
  var self = this

  this.finishedEmits = 0
  this.emitters = []
  this.fails = []
  this.finished = false
  this.runned = false
  this.eventEmitter = null
  this.results = []
  
  emitters = emitters || []
  emitters.forEach(function(emitter) { self.add(emitter) })
}
Utils.addEventEmitter(QueryChainer)

QueryChainer.prototype.add = function(emitter) {
  this.observeEmitter(emitter)
  this.emitters.push(emitter)
  return this
}
QueryChainer.prototype.observeEmitter = function(emitter) {
  var self = this
  emitter
    .on('success', function(res){
      var len = self.emitters.length;
      for(var i=0;i< len;i++)
      {
          if(self.results[i] == undefined ) self.results[i]=[]
          if(self.emitters[i] == emitter){
              self.results[i] = res;
           }
      }
      self.finishedEmits++
      self.finish( )
    })
    .on('failure', function(err){
      self.finishedEmits++
      self.fails.push(err)
      self.finish()
    })
}
QueryChainer.prototype.finish = function(result) {
  this.finished = (this.finishedEmits == this.emitters.length)
  if(this.finished && this.runned) {
    var status = this.fails.length == 0 ? 'success' : 'failure'
    result = this.fails.length == 0 ? this.results : this.fails
    this.eventEmitter.emit(status, result)
  }
}
QueryChainer.prototype.run = function() {
  var self = this
  this.eventEmitter = new Utils.CustomEventEmitter(function() {
    self.runned = true
    self.finish()
  })
  return this.eventEmitter.run()
}