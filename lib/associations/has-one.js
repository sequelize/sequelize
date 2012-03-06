var Utils     = require("./../utils")
  , DataTypes = require('./../data-types')

module.exports = (function() {
  var HasOne = function(srcDAO, targetDAO, options) {
    this.source = srcDAO
    this.target = targetDAO
    this.options = options
    this.isSelfAssociation = (this.source.tableName == this.target.tableName)

    if(this.isSelfAssociation && !this.options.foreignKey && !!this.options.as)
      this.options.foreignKey = Utils._.underscoredIf(Utils.singularize(this.options.as) + "Id", this.options.underscored)

    this.associationAccessor = this.isSelfAssociation
      ? Utils.combineTableNames(this.target.tableName, this.options.as || this.target.tableName)
      : this.options.as || this.target.tableName

    this.accessors = {
      get: Utils._.camelize('get_' + (this.options.as || Utils.singularize(this.target.tableName))),
      set: Utils._.camelize('set_' + (this.options.as || Utils.singularize(this.target.tableName)))
    }
  }

  // the id is in the target table
  HasOne.prototype.injectAttributes = function() {
    var newAttributes = {}

    this.identifier = this.options.foreignKey || Utils._.underscoredIf(Utils.singularize(this.source.tableName) + "Id", this.options.underscored)
    newAttributes[this.identifier] = { type: DataTypes.INTEGER }
    Utils._.extend(this.target.rawAttributes, newAttributes)

    return this
  }

  HasOne.prototype.injectGetter = function(obj) {
    var self = this

    obj[this.accessors.get] = function() {
      var id    = obj.id
        , where = {}

      where[self.identifier] = id
      return self.target.find({where: where})
    }

    return this
  }

  HasOne.prototype.injectSetter = function(obj) {
    var self = this

    obj[this.accessors.set] = function(associatedObject) {
      var customEventEmitter = new Utils.CustomEventEmitter(function() {
        obj[self.accessors.get]().success(function(oldObj) {
          if(oldObj) {
            oldObj[self.identifier] = null
            oldObj.save()
          }

          associatedObject[self.identifier] = obj.id
          associatedObject.save()
          .success(function() { customEventEmitter.emit('success', associatedObject) })
          .error(function(err) { customEventEmitter.emit('failure', err) })
        })
      })
      return customEventEmitter.run()
    }

    return this
  }

  return HasOne
})()
