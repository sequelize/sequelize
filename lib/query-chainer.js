'use strict';

var Utils = require('./utils')
  , deprecatedSeen = {}
  , deprecated = function(message) {
    if (deprecatedSeen[message]) return;
    console.warn(message);
    deprecatedSeen[message] = true;
  };

module.exports = (function() {
  /**
   * The sequelize query chainer allows you to run several queries, either in parallel or serially, and attach a callback that is called when all queries are done.
   *
   * @deprecated The query chainer is deprecated, and due for removal soon. Please use [promises](API-Reference-Promise) instead!
   * @class QueryChainer
   */
  var QueryChainer = function(emitters) {
    var self = this;

    deprecated('The query chainer is deprecated, and due for removal in v. 2.2. Please use promises (http://sequelize.readthedocs.org/en/latest/api/promise/) instead!');

    this.finishedEmits = 0;
    this.emitters = [];
    this.serials = [];
    this.fails = [];
    this.serialResults = [];
    this.emitterResults = [];
    this.finished = false;
    this.wasRunning = false;
    this.eventEmitter = null;

    emitters = emitters || [];
    emitters.forEach(function(emitter) {
      if (Array.isArray(emitter)) {
        self.add.apply(self, emitter);
      } else {
        self.add(emitter);
      }
    });
  };

  /**
   * Add an query to the chainer. This can be done in two ways - either by invoking the method like you would normally, and then adding the returned emitter to the chainer, or by passing the
   * class that you want to call a method on, the name of the method, and its parameters to the chainer. The second form might sound a bit cumbersome, but it is used when you want to run
   * queries in serial.
   *
   * *Method 1:*
   * ```js
   * chainer.add(User.findAll({
   *   where: {
   *     admin: true
   *   },
   *   limit: 3
   * }))
   * chainer.add(Project.findAll())
   * chainer.run().done(function (err, users, project) {
   *
   * })
   * ```
   *
   * *Method 2:*
   * ```js
   * chainer.add(User, 'findAll', {
   *   where: {
   *     admin: true
   *   },
   *   limit: 3
   * })
   * chainer.add(Project, 'findAll')
   * chainer.runSerially().done(function (err, users, project) {
   *
   * })
   * ```
   * @param  {EventEmitter|Any} emitterOrKlass
   * @param  {String} [method]
   * @param  {Object} [params]
   * @param  {Object} [options]
   * @return this
   */
  QueryChainer.prototype.add = function(emitterOrKlass, method, params, options) {
    if (!!method) {
      this.serials.push({ klass: emitterOrKlass, method: method, params: params, options: options });
    } else {
      observeEmitter.call(this, emitterOrKlass);
      this.emitters.push(emitterOrKlass);
    }

    return this;
  };

  /**
   * Run the query chainer. In reality, this means, wait for all the added emtiters to finish, since the queries began executing as soon as you invoked their methods.
   * @return {EventEmitter}
   */
  QueryChainer.prototype.run = function() {
    var self = this;
    this.eventEmitter = new Utils.CustomEventEmitter(function() {
      self.wasRunning = true;
      finish.call(self, 'emitterResults');
    });
    return this.eventEmitter.run();
  };

  /**
   * Run the chainer serially, so that each query waits for the previous one to finish before it starts.
   * @param  {Object}      [options]
   * @param  {Object}      [options.skipOnError=false] If set to true, all pending emitters will be skipped if a previous emitter failed
   * @return {EventEmitter}
   */
  QueryChainer.prototype.runSerially = function(options) {
    var self = this
      , serialCopy = Utils._.clone(this.serials);

    options = Utils._.extend({
      skipOnError: false
    }, options);

    var exec = function() {
      var serial = self.serials.pop();

      if (serial) {
        serial.options = serial.options || {};
        if (serial.options.before)
          serial.options.before(serial.klass);

        var onSuccess = function() {
          if (serial.options.after)
            serial.options.after(serial.klass);
          self.finishedEmits++;
          exec();
        };

        var onError = function(err) {
          if (serial.options.after)
            serial.options.after(serial.klass);
          self.finishedEmits++;
          self.fails.push(err);
          exec();
        };

        if (options.skipOnError && (self.fails.length > 0)) {
          onError('Skipped due to earlier error!');
        } else {
          var emitter = serial.klass[serial.method].apply(serial.klass, serial.params);

          emitter.success(function(result) {
            self.serialResults[serialCopy.indexOf(serial)] = result;

            if (serial.options.success) {
              serial.options.success(serial.klass, onSuccess);
            } else {
              onSuccess();
            }
          }).error(onError).on('sql', function(sql) {
            self.eventEmitter.emit('sql', sql);
          });
        }
      } else {
        self.wasRunning = true;
        finish.call(self, 'serialResults');
      }
    };

    this.serials.reverse();
    this.eventEmitter = new Utils.CustomEventEmitter(exec);
    return this.eventEmitter.run();
  };

  // private

  var observeEmitter = function(emitter) {
    var self = this;

    emitter
      .then(function(result) {
        self.emitterResults[self.emitters.indexOf(emitter)] = result;
        self.finishedEmits++;
        finish.call(self, 'emitterResults');
      })
      .catch(function(err) {
        self.finishedEmits++;
        self.fails.push(err);
        finish.call(self, 'emitterResults');
      });
  };

  var finish = function(resultsName) {
    this.finished = true;

    if (this.emitters.length > 0) {
      this.finished = (this.finishedEmits === this.emitters.length);
    }
    else if (this.serials.length > 0) {
      this.finished = (this.finishedEmits === this.serials.length);
    }

    if (this.finished && this.wasRunning) {
      var status = (this.fails.length === 0 ? 'success' : 'error')
        , result = (this.fails.length === 0 ? this[resultsName] : this.fails);

      this.eventEmitter.emit.apply(this.eventEmitter, [status, result].concat(result));
    }
  };

  return QueryChainer;
})();
