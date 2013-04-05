/*global define:false, require:false, Prism:false*/

define([
  'controllers/base/controller',
  'lib/view_helper'
], function(Controller, ViewHelper) {
  'use strict';

  return Controller.extend({
    heroku: function() {
      this.title = 'Sequelize on Heroku'

      require([
        'views/pages/heroku/index',
        'views/pages/heroku/navigation',
        'bootstrap'
      ], function(IndexView, NavigationView) {
        new IndexView()
          .on('rendered', function() {
            this.$el.html(ViewHelper.fixCodeIndentation(this.$el).html())
            Prism.highlightAll()

            new NavigationView({ controller: 'heroku' })
          })
          .render()
      })
    }
  })
})
