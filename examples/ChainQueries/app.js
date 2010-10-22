/*
  Title: Using the chainQueries function

  This example demonstrates the use of chainQueries.
*/

var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize
var sys = require("sys")
var Class = function(){ sys.log("You've just created a new instance!") }
Class.prototype.add = function(a,b,callback){
  this.result = a + b
  sys.log("The result: " + this.result)
  callback(this.result)
}




sys.log("First of all the old and obsolete way:")

Sequelize.chainQueries([
  {add: (new Class()), params: [1, 2]},
  {add: (new Class()), params: [2, 3]}
], function() {
  sys.log("And we did it!")
})


sys.puts("")
sys.log("The new fashioned way is about removing the array and pass an arbitrary amount of parameters!")
sys.log("Just pass as many hashes as you want, but at the end a function as callback!")

Sequelize.chainQueries(
  {add: new Class(), params: [1, 2]},
  {add: new Class(), params: [2, 3]},
  function() { sys.log("And we did it! Great!") }
)


sys.puts("")
sys.log("As you see we add some values two times.")
sys.log("Let's say you want to call a method on multiple objects with the same or no parameters!")

Sequelize.chainQueries(
  {add: [new Class(), new Class()], params: [1, 2]},
  function() { sys.log("And we did it! Great!") }
)