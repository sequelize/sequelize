'use strict';

var dox = require('dox')
  , program = require('commander')
  , fs = require('fs')
  , path = require('path')
  , git = require('git')
  , _ = require('lodash');

program
  .version('0.0.2')
  .option('-f, --file [file]', 'Process a single file', '')
  .option('-a, --all', 'Process all files, generate index etc. (default if no options are specified')
  .option('-o --out [dir]', '', path.dirname(__filename) + '/api')
  .parse(process.argv);

var files;
if (program.file) {
  files = [{file: program.file, output: 'tmp'}];
} else {
  files = [
    {file:'lib/errors.js', output: 'errors'},
    {file:'lib/sequelize.js', output: 'sequelize'},
    {file:'lib/instance.js', output: 'instance'},
    {file:'lib/model.js', output: 'model'},
    {file:'lib/hooks.js', output: 'hooks'},
    {file:'lib/associations/mixin.js', output: 'associations/index'},
    {file:'lib/transaction.js', output: 'transaction'},
    {file:'lib/data-types.js', output: 'datatypes'},
    {file:'lib/deferrable.js', output: 'deferrable'},
    {file:'lib/associations/belongs-to-many.js', output: 'associations/belongs-to-many'},
    {file:'lib/associations/has-many.js', output: 'associations/has-many'},
    {file:'lib/associations/has-one.js', output: 'associations/has-one'},
    {file:'lib/associations/belongs-to.js', output: 'associations/belongs-to'}
  ];
}

var Comment = function(data, file) {
  this.data = data;
  this.file = file;
  this.string = '';
};

Comment.prototype.getTag = function(tagName) {
  return _.find(this.data.tags, function (tag) {
    return tag.type === tagName;
  });
};

Comment.prototype.getTags = function(tagName) {
  return _.where(this.data.tags, { type: tagName });
};

Comment.prototype.hasTag = function(tagName) {
  return this.getTag(tagName) !== undefined;
};

Comment.prototype.getName = function () {
  var tag = (['name', 'class', 'property', 'method']).reduce(function (tag, tagName) {
    return tag || this.getTag(tagName);
  }.bind(this), null);

  if (tag) {
    return tag.string;
  }

  return this.data.ctx.name;
};

Comment.prototype.getParams = function () {
  if (this.isProperty()) {
    return '';
  }

  // Only show params without a dot in them (dots means attributes of object, so no need to clutter the signature too much)
  var params = [] ;
  this.getTags('param').forEach(function (paramTag) {
    if (paramTag.name.indexOf('.') === -1) {
      params.push(paramTag.name);
    }
  });

  return '(' + params.join(', ') + ')';
};

Comment.prototype.isProperty = function () {
  return !this.hasTag('method') && this.data.ctx && this.data.ctx.type === 'property';
};

Comment.prototype.putString = function(str) {
  this.string += str;
};

Comment.prototype.putLine = function(str) {
  str = str || '';
  this.putString(str + "\n");
};

Comment.prototype.putLines = function(lines) {
  lines.forEach(function (line) {
    this.putLine(line);
  }, this);
};

Comment.prototype.toString = function () {
  return this.string + "\n";
};

['class', 'mixin', 'constructor'].forEach(function (prop) {
  Comment.prototype['is' + prop.charAt(0).toUpperCase() + prop.slice(1)] = function () {
    return this.hasTag(prop);
  };
});

Comment.prototype.githubLink = function() {
  return 'https://github.com/sequelize/sequelize/blob/' + Comment.commit + '/' + this.file + '#L' + this.data.codeStart;
};

Comment.concatTypes = function (types, convertEntities) {
  if (convertEntities === undefined) {
    convertEntities = true;
  }

  var type = types.join('|');

  if (type.indexOf('<') !== -1 && type.indexOf('>') === -1) {
    // If the string is Array<something|somethingelse> the closing > disappears...
    type += '>';
  }

  if (convertEntities) {
    type = Comment.escapeForTable(type);
  }

  return type;
};

Comment.escapeForTable = function (text) {
  // Convert a couple of things to their HTML-entities
  // The spacing around | is intentional, in order to introduce some linebreaks in the params table
  return text.replace(/\|/g, ' &#124; ')
    .replace(/>/g, '&gt;')
    .replace(/</g, '&lt;');
};

var parseComments = function (comments, file) {
  var output = ''
    , comment
    , name
    , returns
    , mixes
    , deprecated
    , see
    , params
    , extend
    , aliases;

  comments.forEach(function (data) {
    if (data.tags.length) {
      comment = new Comment(data, file);
      name = comment.getName();

      comment.putLine('<a name="' + name.toLowerCase() + '"></a>');
      if (comment.isClass()) {
        comment.putLine('# Class ' + name);
      } else if (comment.isMixin()) {
        comment.putLine('# Mixin ' + name);
      } else if (comment.isConstructor()) {
        comment.putLine('## `new ' + name + comment.getParams() + '`');
      } else {
        comment.putString('## `' + name + comment.getParams() + '`');

        if (comment.hasTag('return')) {
          returns = comment.getTag('return');

          var returnType = Comment.concatTypes(returns.types, false); // We don't convert HTML entities since tihs is displayed in a literal block
          comment.putString(' -> `' + returnType + '`');
        }
        comment.putLine();
      }

      comment.putLine('[View code](' + comment.githubLink() + ')');
      comment.putLine();
      comment.putLine(comment.data.description.full);

      if ((mixes = comment.getTags('mixes')).length) {
        comment.putLine('### Mixes:');

        mixes.forEach(function (mixin) {
          comment.putLine('* ' + mixin.string);
        });
      }

      if (deprecated = comment.getTag('deprecated')) {
        comment.putLine('**Deprecated** ' +  deprecated.string);
      }

      if ((see = comment.getTags('see')).length) {
        comment.putLine();
        comment.putLine('**See:**');
        comment.putLine();

        var link;
        see.forEach(function (see) {
          if (see.local) {
            link = see.local.match(/{(.*?(?:|#.*?))}/)[1];

            comment.putLine('* [' + link + '](' + link.toLowerCase() + ')');
          } else {
            comment.putLine('* [' + see.title | see.url + '](' + see.url + ')');
          }
        });

        comment.putLine();
      }

      if (comment.hasTag('param')) {
        params = comment.getTags('param');

        comment.putLines([
          '',
          '**Params:**',
          '',
          '| Name | Type | Description |',
          '| ---- | ---- | ----------- |'
        ]);

        var type;
        params.forEach(function (param) {
          type = Comment.concatTypes(param.types);

          comment.putLine('| ' + Comment.escapeForTable(param.name) + ' | ' + type + ' | ' + Comment.escapeForTable(param.description) + ' |');
        });
        comment.putLine();
      }

      if (returns && returns.description) {
        comment.putLine('__Returns:__ ' + returns.description);
      }

      if ((aliases = comment.getTags('alias')).length) {
        comment.putLine('__Aliases:__ ' + aliases.map(function (a) {
          return a.string;
        }).join(', '));
      }

      if (extend = comment.getTag('extends')) {
        comment.putLine();
        comment.putLine('__Extends:__ ' + extend.otherClass);
      }

      comment.putLine();
      comment.putLine('***');
      output += comment.toString();
    }
  });

  output += '_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_';

  return output;
};

var code, obj, output, path;

new git.Repo(path.dirname(__filename) + '/..', function (err, repo) {
  repo.head(function (err, status) {
    Comment.commit = status.commit;

    files.forEach(function (file) {
      fs.readFile(file.file, function (err, code) {
        obj = dox.parseComments(code.toString(), { raw: true});
        path = program.out + '/' + file.output + '.md';

        console.log(path)

        var output = parseComments(obj, file.file);
        fs.writeFile(path, output);
      });
    });
  });
});
