var Utils = require("../../utils")

var ConnectorManager = module.exports = function() {

}
Utils._.extend(ConnectorManager.prototype, require("../connector-manager").prototype)

ConnectorManager.prototype.connect = function() {
  return ''
}
