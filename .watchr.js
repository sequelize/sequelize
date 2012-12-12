var watchr = require('watchr')
  , spawn  = require('child_process').spawn

watchr.watch({
  path: __dirname,
  listener: function(eventName, filePath) {
    if (['new', 'change'].indexOf(eventName) > -1) {
      var buster = spawn('./node_modules/.bin/buster-test', ['--reporter', 'specification'], { env: process.ENV })

      buster.stderr.on('data', function(data) { console.log(data.toString()) })
      buster.stdout.on('data', function(data) { console.log(data.toString()) })
    }
  }
})
