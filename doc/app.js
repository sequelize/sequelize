var express = require('express')
var app = module.exports = express.createServer()

// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views')
  app.set('view engine', 'ejs')
  app.helpers(require("express-view-helpers"))
  app.helpers({
    koala: require("koala").render
  })
  app.use(express.bodyParser())
  app.use(express.methodOverride())
  app.use(require('connect').compiler({ src: __dirname + '/public', enable: ['less'] }))
  app.use(app.router)
  app.use(express.static(__dirname + '/public'))
})

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })) 
})

app.configure('production', function(){
  app.use(express.errorHandler()) 
})

// Routes
app.get("/background", function(req, res) {
  require("fs").readdir(__dirname + "/public/images/", function(err, files) {
    if(err) sys.log(err)
    else {
      if(files[0] == ".DS_Store") files.shift()
      var i = Math.round(Math.random() * (files.length - 1))
      res.sendfile(__dirname + "/public/images/" + files[i])
    }
  })
})

app.get('/', function(req, res){
  var navigation = {
    "installation": 'Installation',
    "basic-mapping": 'Basic Mapping',
    "sync-with-db": 'Synchronize with database',
    "instances": "Creating and working with instances",
    "expanding-models": "Expanding models",
    "chain-queries": "Chain queries",
    "associations": "Associations",
    "find-objects": "Finding objects",
    "projects": "Sequelize-based projects"
  }
  
  res.render('index', {
    navigation: navigation,
    active: req.param('active') || 'installation'
  })
})

if (!module.parent) {
  app.listen(3000)
  console.log("Express server listening on port %d", app.address().port)
}