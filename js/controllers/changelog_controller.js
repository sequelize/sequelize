/*global define:false, require:false*/

define([
  'controllers/base/controller',
  'models/changelog_collection'
], function(Controller, ChangelogCollection) {
  'use strict';

  return Controller.extend({
    title: 'Changelog',

    index: function() {
      new ChangelogCollection().fetch({
        success: function(collection) {
          require([
            'views/changelog/index',
            'views/changelog/navigation',
            'bootstrap'
          ], function(IndexView, NavigationView) {
            new IndexView({ collection: collection })
              .on('render', function() {
                new NavigationView({ controller: 'changelog' })
              })
              .render()
          })
        }
      })
    }
  })
})
