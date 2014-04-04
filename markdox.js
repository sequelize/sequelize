var markdox = require('markdox')
  , ghm = require("github-flavored-markdown")
  , fs = require('fs')
  , _ = require('lodash');

var getTag = function(tags, tagName) {
  return _.find(tags, function (tag) {
    return tag.type === tagName;
  });
};

var getTags = function(tags, tagName) {
  return _.where(tags, function (tag) {
    return tag.type === tagName;
  });
}

var options = {
  output: 'output.md',
  formatter: function (docfile) {
    docfile = markdox.defaultFormatter(docfile);

    docfile.members = [];
    docfile.javadoc.forEach(function(javadoc){
      // Find constructor tags
      javadoc.isConstructor = getTag(javadoc.raw.tags, 'constructor') !== undefined;
      javadoc.isMixin = getTag(javadoc.raw.tags, 'mixin') !== undefined;
      javadoc.isProperty = getTag(javadoc.raw.tags, 'property') !== undefined
      javadoc.mixes = getTags(javadoc.raw.tags, 'mixes');
      
      // Only show params without a dot in them (dots means attributes of object, so no need to clutter the signature too much)
      var params = [] 
      javadoc.paramTags.forEach(function (paramTag) {
        if (paramTag.name.indexOf('.') === -1) {
          params.push(paramTag.name);
        }

      });
      javadoc.paramStr = params.join(', ');

      // Convert | to &#124; to be able to use github flavored md tables
      if (javadoc.paramTags) {
        javadoc.paramTags.forEach(function (paramTag) {
          paramTag.joinedTypes = paramTag.joinedTypes.replace(/\|/g, '&#124;')
        });
      }

      // Handle aliases
      javadoc.aliases = getTags(javadoc.raw.tags, 'alias').map(function (a) {
        return a.string
      }).join(', ')

      // Handle deprecation text
      if (javadoc.deprecated) {
        var deprecation = getTag(javadoc.raw.tags, 'deprecated')
        javadoc.deprecated = deprecation.string
      }

      // Handle linking in comments
      javadoc.see = getTags(javadoc.raw.tags, 'see');
      javadoc.see.forEach(function (see, i, collection) {
        collection[i] = {}

        if (see.local) {
          collection[i].external = false

          if (see.local.indexOf('{') === 0){
            var _see = see.local.split('}')
            _see[0] = _see[0].substring(1)
            collection[i].url = _see[0]

            collection[i].text = see.local.replace(/{|}/g, '')          
          } else {
            collection[i].url = false
            collection[i].text = see.local
          }
        } else {
          see.external = true
          collection[i] = see
        }
      })

      // Set a name for properties
      if (!javadoc.name) {
        var property = getTag(javadoc.raw.tags, 'property')
        if (property) {
          javadoc.name = property.string
        }
      }
      if (javadoc.isMixin) {
        javadoc.name = getTag(javadoc.raw.tags, 'mixin').string;
      }

      if (!javadoc.isClass) {
        if (!javadoc.isProperty) {
          docfile.members.push(javadoc.name + '(' + javadoc.paramStr + ')')
        } else {
          docfile.members.push(javadoc.name)
        }
      }
    });

    return docfile;
  },
  template: 'output.md.ejs'
};

markdox.process(process.argv[2] || './lib/hooks.js', options, function(){
  // var md = fs.readFileSync('output.md').toString();
  // fs.writeFileSync('out.html', ghm.parse(md));
});

