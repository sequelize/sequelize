var markdox = require('markdox')
  , ghm = require("github-flavored-markdown")
  , fs = require('fs')
  , _ = require('lodash');

var getTag = function(tags, tagName) {
  return _.find(tags, function (tag) {
    return tag.type === tagName
  });
};

// TODO multiple @see tags
var options = {
  output: 'output.md',
  formatter: function (docfile) {
    docfile = markdox.defaultFormatter(docfile);

    docfile.members = [];
    docfile.javadoc.forEach(function(javadoc, index){
      // Find constructor tags
      docfile.javadoc[index].isConstructor = getTag(javadoc.raw.tags, 'constructor') !== undefined;
      
      // Only show params without a dot in them (dots means attributes of object, so no need to clutter the co)
      var params = [] 
      javadoc.paramTags.forEach(function (paramTag) {
        if (paramTag.name.indexOf('.') === -1) {
          params.push(paramTag.name);
        }
      });
      javadoc.paramStr = params.join(', ');

      // Handle linking in comments
      if (javadoc.see) {
        if (javadoc.see.indexOf('{') === 0){
          var see = javadoc.see.split('}')
          see[0] = see[0].substring(1)
          if (javadoc.see.indexOf('www') !== -1) {
            javadoc.seeExternal = true
          } else {
            javadoc.seeExternal = false
          }
          javadoc.seeURL = see[0]

          if (see[1] !== "") {
            javadoc.seeText = see[1]
          } else {
            javadoc.seeText = see[0]
          }
        } else {
          javadoc.seeURL = false
        }
      }

      // Set a name for properties
      if (!javadoc.name) {
        var property = getTag(javadoc.raw.tags, 'property')
        if (property) {
          javadoc.name = property.string
        }
      }

      if (!javadoc.isClass) {
        docfile.members.push(javadoc.name)
      }
    });

    return docfile;
  },
  template: 'output.md.ejs'
};

markdox.process('./lib/sequelize.js', options, function(){
  md = fs.readFileSync('output.md').toString();

  fs.writeFileSync('out.html', ghm.parse(md));
});

