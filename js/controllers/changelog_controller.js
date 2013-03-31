/*global define:false, require:false*/

define([
  'controllers/base/controller',
  'models/changelog_collection'
], function(Controller, ChangelogCollection) {
  'use strict';

  return Controller.extend({
    title: 'Changelog',

    historyURL: function() {
      return ''
    },

    index: function() {
      new ChangelogCollection().fetch({
        success: function(collection) {
          require([
            'views/changelog/index',
            'bootstrap'
          ], function(View) {
            new View({ collection: collection })
          })
        }
      })
    }
  })
})
