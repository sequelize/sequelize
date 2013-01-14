var fs = require('fs'),
  child_process =  require('child_process');

var specs = [];

var walk = function(path, callback) {
  var files = fs.readdirSync(path);
  var count = files.length;
  files.forEach(function(file) {
    fs.stat(path + '/' + file, function (err, stat) {
      if (stat && stat.isDirectory()) {
        walk(path + '/' + file, function() {
          count--;
          if (count === 0) {
            callback();
          }
        });
      } else {
        if (file.indexOf(".spec.js") !== -1) {
          specs.push(path+'/'+file);
        }
        count--;
        if (count === 0) {
          callback();
        }
      }
    });
  });
};


walk(__dirname, function () {
  var i = 0;

  var exec = function () {
    var spec = specs[i++];

    if (spec) {
      var child = child_process.exec('node ' + spec, null, function (err, stdout, sterr) {
        exec();
      });
      child.stdout.pipe(process.stdout);
      child.stderr.pipe(process.stderr);  
    }
  }
  
  exec();
});