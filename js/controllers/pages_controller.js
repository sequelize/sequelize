/*global define:false, require:false, Prism:false*/

define([
  'controllers/base/controller',
  'lib/view_helper'
], function(Controller, ViewHelper) {
  'use strict';

  Prism.languages.bash = {
    'important': /(^#!\s*\/bin\/bash)|(^#!\s*\/bin\/sh)/g,
    'comment': /(^|[^"{\\])(#.*?(\r?\n|$))/g,
    'string': {
      //allow multiline string
      pattern: /("|')(\\?[\s\S])*?\1/g,
      inside: {
        'property': /\$([a-zA-Z0-9_#\?\-\*!@]+|\{[^\}]+\})/g
      }
    },
    'property': /\$([a-zA-Z0-9_#\?\-\*!@]+|\{[^}]+\})/g,
    'keyword': /\b(if|then|else|elif|fi|for|break|continue|while|in|case|function|select|do|done|until|echo|exit|return|set|declare)\b/g,
    'boolean': /\b(true|false)\b/g,
    'number': /\b(0x[\da-fA-F]+|-?\d*\.?\d+)\b/g,
    'operator': /[-+]{1,2}|!|=?<|=?>|={1,2}|(&){1,2}|\|?\||\?|\*|\//g,
    'ignore': /&(lt|gt|amp);/gi,
    'punctuation': /[{}[\];(),.:]/g
  };

  return Controller.extend({
    heroku: function() {
      this.title = 'Sequelize on Heroku'

      require([
        'views/pages/heroku/index',
        'views/pages/heroku/navigation',
        'bootstrap'
      ], function(IndexView, NavigationView) {
        new NavigationView({ controller: 'heroku' })
        new IndexView()
          .on('rendered', function() {
            this.$el.html(ViewHelper.fixCodeIndentation(this.$el).html())
            Prism.highlightAll()
          })
          .render()
      })
    }
  })
})
