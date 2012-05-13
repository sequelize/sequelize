var Pooling = require('generic-pool')
  , Query   = require("./query")
  , Utils   = require("../../utils")
  , without = function(arr, elem) { return arr.filter(function(e) { return e != elem }) }
  , util    = require("util")
  , events  = require("events")

module.exports = (function() {
  var ConnectorManager = function(sequelize, config) {
    events.EventEmitter.call(this)
    this.sequelize = sequelize
    this.client = null
    this.config = config || {}
    this.disconnectTimeoutId = null
    this.queue = []
    this.activeQueue = []
    this.maxConcurrentQueries = (this.config.maxConcurrentQueries || 50)
    this.poolCfg = this.config.pool
    var self = this
    if (this.poolCfg) {
      //the user has requested pooling, so create our connection pool
      if (!this.poolCfg.maxConnections) {
        this.poolCfg.maxConnections = 10
      }
      this.pool = Pooling.Pool({
        name: 'sequelize-mysql',
        create: function (done) {
            connect.call(self, done)
        },
        destroy: function(client) {
            disconnect.call(self, client, function() {
              self.emit('disconnect', client)
            })
        },
        max: self.poolCfg.maxConnections,
        idleTimeoutMillis: self.poolCfg.maxIdleTime
      })
    }
    process.on('exit', function () {
      //be nice & close our connections on exit
      if (self.pool) {
        self.pool.drain()
      } else if (self.client) {
        disconnect(self.client, function() {
          self.emit('disconnect', self.client)
          self.client = null
        })
      }

      return
    })
  }
  Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)
  util.inherits(ConnectorManager, events.EventEmitter)

  var isConnecting = false

  ConnectorManager.prototype.query = function(sql, callee, options) {

    var queueItem = {
      query: new Query(this, callee, options || {}),
      sql: sql
    }

    enqueue.call(this, queueItem)

    return queueItem.query
  }

  ConnectorManager.prototype.connect = function(done) {
    var self = this
    // in case database is slow to connect, prevent orphaning the client
    if (self.isConnecting) {
      setTimeout(function() {
        self.connect(done)
      }, 10)
      return
    }
    
    if (self.isConnected) {
      if (done)
        done()
      return
    }
    
    connect.call(self, function(err, client) {
      if (err) {
        if (done)
          done(err)
        else
          throw err;
      }
      self.client = client
      self.emit('connect', self.client)
      if (done)
        done()
     return
    })
  }

  ConnectorManager.prototype.disconnect = function(done) {
    var self = this
    if (!self.client) {
      if (done)
        done()
      return
    }
    
    disconnect.call(self, self.client, function() {
      self.emit('disconnect', self.client)
      self.client = null
      if (done)
        done()
    })
  }


  // private

  var disconnect = function(client, done) {
    var self = this
    client.end(function() {
      var intervalObj = null
      var cleanup = function () {
        var retryCt = 0
        // make sure to let client finish before calling destroy
        if (self && self.hasQueuedItems) {
          return
        }
        // needed to prevent mysql connection leak
        client.destroy()
        clearInterval(intervalObj)
        done()
      }
      intervalObj = setInterval(cleanup, 10)
      cleanup()
      return
    })
  }

  var connect = function(done) {
    var self = this
    self.isConnecting = true
    var client = require("mysql").createClient({
      user: self.config.username,
      password: self.config.password,
      host: self.config.host,
      port: self.config.port,
      database: self.config.database
    })
    client.setMaxListeners(self.maxConcurrentQueries)
    if (self.config.utcoffset != null) {
      client.query( "SET time_zone = '" + self.config.utcoffset + "'", function(error) {
        if (error) {
          done(error, client)
        }

        self.isConnecting = false
        done(null, client)
      });
      return
    }
    self.isConnecting = false
    done(null, client)
    return
  }

  var enqueue = function(queueItem) {
    if(this.activeQueue.length < this.maxConcurrentQueries) {
      this.activeQueue.push(queueItem)
      if (this.pool) {
        var self = this
        this.pool.acquire(function(err, client) {
          if (err) {
            queueItem.query.emit('failure', err)
            return
          }
          //we set the client here, asynchronously, when getting a pooled connection
          //allowing the ConnectorManager.query method to remain synchronous
          queueItem.query.client = client
          queueItem.client = client
          execQueueItem.call(self, queueItem)
          return
        })
      }
      else
      {
        execQueueItem.call(this, queueItem)
      }
    } else {
      this.queue.push(queueItem)
    }
  }

  var dequeue = function(queueItem) {
    //return the item's connection to the pool
    if (this.pool) {
      this.pool.release(queueItem.client)
    }
    this.activeQueue = without(this.activeQueue, queueItem)
  }

  var transferQueuedItems = function(count) {
    for(var i = 0; i < count; i++) {
      var queueItem = this.queue[0]
      if(queueItem) {
        enqueue.call(this, queueItem)
        this.queue = without(this.queue, queueItem)
      }
    }
  }

  var afterQuery = function(queueItem) {
    var self = this

    dequeue.call(this, queueItem)
    transferQueuedItems.call(this, this.maxConcurrentQueries - this.activeQueue.length)
    disconnectIfNoConnections.call(this)
  }


  var execQueueItem = function(queueItem) {
    var self = this

    queueItem.query
      .success(function(){ afterQuery.call(self, queueItem) })
      .error(function(){ afterQuery.call(self, queueItem) })

    queueItem.query.run(queueItem.sql, queueItem.client)
  }

  ConnectorManager.prototype.__defineGetter__('hasQueuedItems', function() {
    return (this.queue.length > 0) || (this.activeQueue.length > 0) || (this.client && this.client._queue && (this.client._queue.length > 0))
  })

  // legacy
  ConnectorManager.prototype.__defineGetter__('hasNoConnections', function() {
    return !this.hasQueuedItems
  })

  ConnectorManager.prototype.__defineGetter__('isConnected', function() {
    return this.client != null
  })

  var disconnectIfNoConnections = function() {
    var self = this

    this.disconnectTimeoutId && clearTimeout(this.disconnectTimeoutId)
    this.disconnectTimeoutId = setTimeout(function() {
      self.isConnected && !self.hasQueuedItems && self.disconnect()
    }, 100)
  }

  return ConnectorManager
})()


