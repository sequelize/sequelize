var Utils = require("./utils")

module.exports = (function() {
  var QueryChainer = function(emitters) {
    var self = this

    this.finishedEmits  = 0
    this.emitters       = []
    this.serials        = []
    this.fails          = []
    this.serialResults  = []
    this.emitterResults = []
    this.finished       = false
    this.wasRunning     = false
    this.eventEmitter   = null

    emitters = emitters || []
    emitters.forEach(function(emitter) {
      if (Array.isArray(emitter)) {
        self.add.apply(self, emitter)
      } else {
        self.add(emitter)
      }
    })
  }

  QueryChainer.prototype.add = function(emitterOrKlass, method, params, options) {
    if (!!method) {
      this.serials.push({ klass: emitterOrKlass, method: method, params: params, options: options })
    } else {
      observeEmitter.call(this, emitterOrKlass)
      this.emitters.push(emitterOrKlass)
    }

    return this
  }

  QueryChainer.prototype.run = function() {
    var self = this
    this.eventEmitter = new Utils.CustomEventEmitter(function() {
      self.wasRunning = true
      finish.call(self, 'emitterResults')
    })
    return this.eventEmitter.run()
  }

  QueryChainer.prototype.runSerially = function(options) {
    var self       = this
      , serialCopy = Utils._.clone(this.serials)

    options = Utils._.extend({
      skipOnError: false
    }, options)

    var exec = function() {
      var serial = self.serials.pop()

      if (serial) {
        serial.options = serial.options || {}
        serial.options.before && serial.options.before(serial.klass)

        var onSuccess = function() {
          serial.options.after && serial.options.after(serial.klass)
          self.finishedEmits++
          exec()
        }

        var onError = function(err) {
          serial.options.after && serial.options.after(serial.klass)
          self.finishedEmits++
          self.fails.push(err)
          exec()
        }

        if (options.skipOnError && (self.fails.length > 0)) {
          onError('Skipped due to earlier error!')
        } else {
          var emitter = serial.klass[serial.method].apply(serial.klass, serial.params)

          emitter.success(function(result) {
            self.serialResults[serialCopy.indexOf(serial)] = result

            if (serial.options.success) {
              serial.options.success(serial.klass, onSuccess)
            } else {
              onSuccess()
            }
          }).error(onError)
        }
      } else {
        self.wasRunning = true
        finish.call(self, 'serialResults')
      }
    }

    this.serials.reverse()
    this.eventEmitter = new Utils.CustomEventEmitter(exec)
    return this.eventEmitter.run()
  }

  // private

  var observeEmitter = function(emitter) {
    var self = this

    emitter
      .success(function(result) {
        self.emitterResults[self.emitters.indexOf(emitter)] = result
        self.finishedEmits++
        finish.call(self, 'emitterResults')
      })
      .error(function(err) {
        self.finishedEmits++
        self.fails.push(err)
        finish.call(self, 'emitterResults')
      })
      .on('sql', function(sql) {
        if (self.eventEmitter) {
          self.eventEmitter.emit('sql', sql)
        }
      })
  }

  var finish = function(resultsName) {
    this.finished = true

    if (this.emitters.length > 0) {
      this.finished = (this.finishedEmits == this.emitters.length)
    }
    else if (this.serials.length > 0) {
      this.finished = (this.finishedEmits == this.serials.length)
    }

    if (this.finished && this.wasRunning) {
      var status = (this.fails.length == 0 ? 'success' : 'error')
        , result = (this.fails.length == 0 ? this[resultsName] : this.fails)

      this.eventEmitter.emit.apply(this.eventEmitter, [status, result].concat(result))
    }
  }

  return QueryChainer
})()
