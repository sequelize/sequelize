var markdox = require('markdox')
  , program = require('commander')
  , fs = require('fs')
  , _ = require('lodash');

program
  .version('0.0.1')
  .option('-f, --file [file]', 'Process a single file', '')
  .option('-a, --all', 'Process all files, generate index etc. (default if no options are specified')
  .option('-c, --clean', 'Remove all generated markdown and HTML files')
  .option('--html', 'Generate html files from the markdown ones (requires manual installation of the github-flavored-markdown package')
  .parse(process.argv)


if (program.clean) {
  fs.readdirSync('docs/').forEach(function (file) {
    if (file.indexOf('.ejs') === -1 && file.indexOf('.js') === -1) {
      fs.unlinkSync ('docs/' + file);
    }
  })

  return 
}

if (program.html) {
  var ghm = require('github-flavored-markdown')
}

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
  formatter: function (docfile) {
    docfile = markdox.defaultFormatter(docfile);

    docfile.members = [];
    docfile.javadoc.forEach(function(javadoc){
      // Find constructor tags
      javadoc.isConstructor = getTag(javadoc.raw.tags, 'constructor') !== undefined;
      javadoc.isMixin = getTag(javadoc.raw.tags, 'mixin') !== undefined;
      javadoc.isProperty = getTag(javadoc.raw.tags, 'property') !== undefined
      javadoc.private = getTag(javadoc.raw.tags, 'private') !== undefined
      
      // Only show params without a dot in them (dots means attributes of object, so no need to clutter the signature too much)
      var params = [] 
      javadoc.paramTags.forEach(function (paramTag) {
        if (paramTag.name.indexOf('.') === -1) {
          params.push(paramTag.name);
        }

      });
      javadoc.paramStr = (javadoc.isMethod || javadoc.isFunction) ? '(' + params.join(', ') + ')' : '';

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
            collection[i].url = 'API-Reference-'  + _see[0]

            collection[i].text = see.local.replace(/{|}/g, '')          
          } else {
            collection[i].url = false
            collection[i].text = see.local
          }
        } else {
          see.external = true
          see.text = see.url
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

      javadoc.mixes = getTags(javadoc.raw.tags, 'mixes').map(function (mix) {
        return {
          text: mix.string,
          link: (mix.string.indexOf('www') !== -1 || mix.string.indexOf('http') !== -1) ? mix.string: 'API-Reference-' + mix.string
        }
      })

      if (!javadoc.isClass) {
        if (!javadoc.isProperty) {
          docfile.members.push({
            text: javadoc.name + javadoc.paramStr,
            link: '#' + javadoc.name
          })
        } else {
          docfile.members.push({
            text: javadoc.name,
            link: '#' + javadoc.name
          })
        }
      }
    });

    return docfile;
  },
  template: 'docs/output.md.ejs'
};

var files;
if (program.file) {
  files = [{file: program.file, output: 'tmp'}]
} else {
  files = [
    {file:'lib/sequelize.js', output: 'API-Reference-Sequelize'},
    {file:'lib/dao.js', output: 'API-Reference-DAO'},
    {file:'lib/dao-factory.js', output: 'API-Reference-DAOFactory'},
    {file:'lib/query-chainer.js', output: 'API-Reference-QueryChainer'},
    {file:'lib/emitters/custom-event-emitter.js', output: 'API-Reference-EventEmitter'},
    {file:'lib/hooks.js', output: 'API-Reference-Hooks'},
    {file:'lib/associations/mixin.js', output: 'API-Reference-Associations'}
  ];
}

files.forEach(function (file) {
  var opts = _.clone(options)
    , output = 'docs/' + file.output + '.md'

  opts.output = output
  markdox.process(file.file, opts, function(){
    if (program.html) {
      var md = fs.readFileSync(output).toString();
      fs.writeFileSync(output.replace('md', 'html'), ghm.parse(md))
    }
  });
})