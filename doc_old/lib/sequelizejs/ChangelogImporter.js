module.exports = function(host, filename, forceFetch) {
  this.filename = filename
  this.host = host
  this.forceFetch = forceFetch
}

module.exports.prototype = {
  markdown: require('markdown'),
  changelogFile: __dirname + "/../../views/partials/changelog.ejs",
  fs: require("fs"),

  fetchChangelog: function(callback) {
    var self    = this
      , https   = require("https")
      , changelog = []

    https.get({ host: this.host, path: this.filename }, function(res) {
      res.setEncoding('utf8')
      res.on('data', function(data) { changelog.push(data.toString()) })
      res.on("end", function() { callback(changelog.join("")) })
    }).on("error", function(err) {
      console.log(err)
    })
  },

  transformChangelog: function(markdownChangelog) {
    return this.markdown
      .toHTML(markdownChangelog)
      .replace(/h1/g, 'h2')
      .replace(/<ul>/g, "<div class='pre_like'><ul>")
      .replace(/<\/ul>/g, "</ul></div>")
  },

  writeChangelog: function(callback) {
    var self = this

    this.fetchChangelog(function(data) {
      var dataParts = data.toString().split(/# (.*?) #/).reverse(),
          changelog = []

      dataParts.pop()

      for(var i = 0; i < dataParts.length; i++) {
        if(i%2 != 1) continue

        var headline = "# " + dataParts[i] + " #\n",
            content  = dataParts[i-1].replace (/^\s+/, '').replace (/\s+$/, '')

        changelog.push('<div><a name="' + dataParts[i] + '"></a>' + self.transformChangelog(headline + content) + '<br></div>')
      }

      self.fs.writeFile(self.changelogFile, changelog.join('<div class="seperator"></div>'), callback)
    })
  },

  run: function() {
    var self = this,
        sys  = require("sys")

    sys.log("Changelog will be updated now!")
    self.writeChangelog(function() {
      sys.log("Changelog written!")
    })
  }
}

/*
  Call it:

  var changelogImporter = new ChangelogImporter(filename, host)
  changelogImporter.run()
*/