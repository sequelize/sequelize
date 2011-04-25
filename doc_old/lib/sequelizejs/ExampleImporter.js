var sys = require("sys"),
    fs  = require("fs")

module.exports = function(forceFetch) {
  var GitHubApi = require(__dirname + "/../node-github/lib/github").GitHubApi

  this.github         = new GitHubApi(true)
  this.forceFetch     = forceFetch
  this.lastUpdateFile = __dirname + "/../../tmp/examplesUpdatedAt.log"
}

module.exports.prototype = {
  fetchExamples: function(callback) {
    var self       = this,
        objectApi  = this.github.getObjectApi(),
        examples   = {},
        addExample = function(path, treeSha, callback) {
          objectApi.showBlob('sdepold', 'sequelize', treeSha, path, function(err, blob) {
            var pathSplit = path.split("/"),
                example   = pathSplit[pathSplit.length - 2],
                file      = pathSplit[pathSplit.length - 1]

            examples[example] = examples[example] || []
            examples[example].push({ filename: file, data: blob.data })

            callback()
          })
        }

    this.github.getRepoApi().getRepoBranches('sdepold', 'sequelize', function(err, branches) {
      var treeSha = branches.master

      objectApi.listBlobs('sdepold', 'sequelize', treeSha, function(err, blobs) {
        if(err) throw new Error(err)

        var exampleCount = Object.keys(blobs).filter(function(name){ return name.indexOf("examples/") == 0 }).length

        for(var path in blobs) {
          if(path.indexOf("examples/") == 0) {
            var finished  = 0

            addExample(path, treeSha, function() {
              if(++finished == exampleCount) callback(examples)
            })
          }
        }
      })
    })
  },

  fetchedDataToExamples: function(data) {
    var result = []

    for(var exampleName in data) {
      var singleData  = data[exampleName],
          example     = { filename: exampleName + ".ejs", name: exampleName, files: [] },
          trim        = function(stringToTrim) {
            return stringToTrim.replace(/^\s+|\s+$/g,"");
          }

      singleData = singleData.sort(function(a,b) {
        return (a.filename.toLowerCase() < b.filename.toLowerCase()) ? -1 : 1
      })

      singleData.forEach(function(file) {
        var content     = file.data,
            description = ""

        if((content.indexOf("/*") == 0) && (content.indexOf("*/") > 0)) {
          var split   = content.split("/*")[1].split("*/"),
              comment = trim(split[0])

          content     = split[1]
          description = comment

          if(comment.indexOf('Title:') != -1) {
            split = comment.split('Title:')[1].split('\n')

            if(file.filename == "app.js")
              example.name = trim(split[0])

            description = trim(split.filter(function(s) { return trim(s) != example.name }).join("\n"))
          }
        }
        example.files.push({filename: file.filename, description: description, code: content})
      })

      result.push(example)
    }

    return result
  },

  examplesToNavigation: function(examples) {
    return examples.map(function(example) {
      return '"<a href=\\"/examples/' + example.filename.replace(".ejs", "") + '\\">' + example.name + '</a>"'
    }).join(",\n")
  },

  writeExamples: function(examples) {
    var self = this

    examples.forEach(function(example) {
      var template = fs.readFileSync(__dirname + '/../../views/examples/exampleTemplate.ejs', "utf8"),
          content  = require('ejs').render(template, { locals: {
            title: example.name,
            files: example.files,
            navigation: self.examplesToNavigation(examples)
          }})
      
      fs.writeFileSync(__dirname + "/../../views/examples/" + example.filename, content)
    })
  },

  run: function() {
    var self = this

    sys.log('Updating examples!')

    this.fetchExamples(function(data) {
      var examples = self.fetchedDataToExamples(data)

      examples = examples.sort(function(a, b) {
        return (a.name.toLowerCase() < b.name.toLowerCase()) ? -1 : 1
      })

      self.writeExamples(examples)
      self.lastUpdatedAt = +new Date()

      sys.log("Finished updating examples!")
    })
  }
}