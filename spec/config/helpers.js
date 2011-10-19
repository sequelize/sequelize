var Helpers = module.exports = {
  async: function(fct) {
    var done = false
    runs(function() {
      fct(function() { return done = true })
    })
    waitsFor(function(){ return done })
  }
}
