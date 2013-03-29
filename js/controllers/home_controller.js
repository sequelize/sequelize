/*global define:false*/

define([
  'controllers/base/controller'
], function(Controller) {
  'use strict';

  return Controller.extend({
    title: 'Home',

    historyURL: function() {
      return ''
    },

    index: function(params) {
      this.redirectTo('/documentation')
    }
  })
})
