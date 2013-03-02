var watchr = require('watchr')
  , spawn  = require('child_process').spawn

watchr.watch({
  paths: [__dirname + '/lib', __dirname + '/spec', __dirname + '/index.js'],
  listener: function(eventName) {
    if (['new', 'change'].indexOf(eventName) > -1) {
      // generate the documentation
      spawn('npm', ['run', 'docs'])

      // run the tests
      var buster = spawn('./node_modules/.bin/buster-test', ['--reporter', 'specification'], { env: process.ENV })
      buster.stderr.on('data', function(data) { console.log(data.toString()) })
      buster.stdout.on('data', function(data) { console.log(data.toString()) })
    }
  }
})
