var Utils     = require("./../utils")
  , DataTypes = require('./../data-types')

module.exports = (function() {
  var HasOne = function(srcDAO, targetDAO, options) {
    this.associationType   = 'HasOne'
    this.source            = srcDAO
    this.target            = targetDAO
    this.options           = options
    this.isSelfAssociation = (this.source.tableName == this.target.tableName)

    if(this.isSelfAssociation && !this.options.foreignKey && !!this.options.as) {
      this.options.foreignKey = Utils._.underscoredIf(Utils.singularize(this.options.as) + "Id", this.options.underscored)
    }

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
    Utils._.defaults(this.target.rawAttributes, newAttributes)

    // Sync attributes to DAO proto each time a new assoc is added
    this.target.DAO.prototype.attributes = Object.keys(this.target.DAO.prototype.rawAttributes);

    return this
  }

  HasOne.prototype.injectGetter = function(obj) {
    var self = this

    obj[this.accessors.get] = function(params) {
      var id    = this.id
        , where = {}

      where[self.identifier] = id

      if (!Utils._.isUndefined(params)) {
        if (!Utils._.isUndefined(params.attributes)) {
          params = Utils._.extend({where: where}, params)
        }
      } else {
        params = {where: where}
      }

      return self.target.find(params)
    }

    return this
  }

  HasOne.prototype.injectSetter = function(obj) {
    var self    = this
      , options = self.options || {}

    obj[this.accessors.set] = function(associatedObject) {
      var instance = this;
      return new Utils.CustomEventEmitter(function(emitter) {
        instance[self.accessors.get]().success(function(oldObj) {
          if(oldObj) {
            oldObj[self.identifier] = null
            oldObj.save()
          }

          if(associatedObject) {
            associatedObject[self.identifier] = instance.id
            associatedObject
              .save()
              .success(function() { emitter.emit('success', associatedObject) })
              .error(function(err) { emitter.emit('error', err) })
          } else {
            emitter.emit('success', null)
          }

        })
      }).run()
    }

    return this
  }

  return HasOne
})()
