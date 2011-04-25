/**
 * Module dependencies.
 */

require.paths.unshift(__dirname + "/lib/node")

var express = require('express'),
    connect = require('connect'),
    fs      = require('fs'),
    http    = require('http'),
    koala   = require('koala'),
    sys     = require('sys'),
    ChangelogImporter = require(__dirname + "/lib/sequelizejs/ChangelogImporter"),
    ExampleImporter   = require(__dirname + "/lib/sequelizejs/ExampleImporter"),
    changelogImporter = new ChangelogImporter("github.com", "/sdepold/sequelize/raw/master/changelog.md", false),
    exampleImporter   = new ExampleImporter(false)

var app = module.exports = express.createServer(
  connect.logger()
)

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views')
  app.use(connect.bodyDecoder())
  app.use(connect.methodOverride())
  app.use(connect.compiler({ src: __dirname + '/public', enable: ['less'] }))
  app.use(app.router)
  app.use(connect.staticProvider(__dirname + '/public'))
})

app.configure('development', function(){
  app.use(connect.errorHandler({ dumpExceptions: true, showStack: true }))
})

app.configure('production', function(){
  app.use(connect.errorHandler())
})

// Routes
app.get('/', function(req, res){
  res.render('index.ejs', {
    locals: { koala: koala }
  })
})

app.get("/changelog", function(req, res) {
  res.render('changelog.ejs')
})

app.get("/examples/:example?", function(req, res) {
  var examples = fs.readdirSync(__dirname + "/views/examples"),
      example  = req.params.example

  if (typeof example != "undefined") {
    console.log(example)
    if(examples.indexOf(example + ".ejs") > -1)
      res.render("examples/" + example + ".ejs", {
        locals: { examples: examples }
      })
    else
      res.redirect("/examples")
  } else {
    res.render("examples/" + examples[0], {
      locals: { examples: examples }
    })
  }
})

app.get("/background", function(req, res) {
  fs.readdir(__dirname + "/public/images/", function(err, files) {
    if(err) sys.log(err)
    else {
      if(files[0] == ".DS_Store") files.shift()
      var i = Math.round(Math.random() * (files.length - 1))
      res.sendfile(__dirname + "/public/images/" + files[i])
    }
  })
})

// Only listen on $ node app.js
if (!module.parent) {
  app.listen(4000)
  sys.log("Server is now listening on port 4000")
  
  var runImporters = function() {
    try { 
      changelogImporter.run()
      exampleImporter.run()
     } catch(e) {
       console.log(e)
     }
  }
  setInterval(runImporters, 1000*60*60)
  runImporters()
}