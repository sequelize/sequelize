var sys = require("sys")

var QueryChainer = function(Helper) {
  this.Helper = Helper
}

var instanceMethods = {
  splitQueryHash: function(queryHash) {
    var method = this.Helper.Array.without(this.Helper.Hash.keys(queryHash), "params")[0],
        object = queryHash[method]

    return { method: method, object: object }
  },
  
  splitArguments: function() {
    var result = { queries: [], callback: null }

    for(var i = 0; i < arguments.length; i++) {
      var arg = arguments[i]
      
      if(typeof arg == 'function') result.callback = arg
      else if(Array.isArray(arg)) arg.forEach(function(o) { result.queries.push(o) })
      else result.queries.push(arg)
    }

    return result
  },
  
  expandMultiQueries: function(queries) {
    var self          = this,
        result        = [],
        multiQueries  = []
    
    queries.forEach(function(queryHash) {
      var splittedQueryHash = self.splitQueryHash(queryHash),
          method            = splittedQueryHash.method,
          object            = splittedQueryHash.object

      if(!Array.isArray(object))
        result.push(queryHash)
      else if(object.length > 0) {
        for(var i = 0; i < object.length; i++) {
          var newQueryHash = { params: queryHash.params }
          newQueryHash[method] = object[i]
          result.push(newQueryHash)
        }
      }
    })

    return result
  },
  
  executeQuery: function(queries, index, callback) {
    var self              = this,
        queryHash         = queries[index],
        splittedQueryHash = this.splitQueryHash(queryHash),
        method            = splittedQueryHash.method,
        object            = splittedQueryHash.object
    
    var iterator  = function() {
      if(queries.length > (index + 1)) self.executeQuery(queries, index + 1, callback)
      else if (callback) callback()
    }

    object[method].apply(object, this.Helper.Array.join(queryHash.params || [], [iterator]))
  },
  
  chain: function() {
    var self = this
    var args     = this.splitArguments.apply(this, arguments),
        queries  = args.queries,
        callback = args.callback
        
    var expandedQueries = this.expandMultiQueries(queries)
    
    if(queries.length > 0) this.executeQuery(expandedQueries, 0, callback)
    else if (callback) callback()
  }
}

for(var methodName in instanceMethods)
  QueryChainer.prototype[methodName] = instanceMethods[methodName]

module.exports.QueryChainer = QueryChainer