/*global define:false, require:false*/

define([
  'controllers/base/controller'
], function(Controller) {
  'use strict';

  return Controller.extend({
    title: 'Documentation',

    index: function() {
      require([
        'views/documentation/index',
        'views/documentation/navigation',
        'bootstrap'
      ], function(IndexView, NavigationView) {
        new NavigationView({ controller: 'documentation' })
        new IndexView()
      })
    }
  })
})
