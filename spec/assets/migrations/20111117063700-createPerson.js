module.exports = {
  up: function(Interface, DataTypes) {
    Interface.createTable('Person', {
      name: DataTypes.STRING
    })
  },
  down: function(Interface) {
    Interface.dropTable('Person')
  }
}
