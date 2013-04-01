/*global define:false*/

define([
  'views/base/collection_view',
  'views/changelog/item',
  'jquery'
], function(View, ItemView, $) {
  'use strict';

  return View.extend({
    className:  'changelog index',
    itemView:   ItemView,
    autoRender: false,

    listen: {
      'render': function() {
        this.$el.prepend($('<h1>Changelog</h1>'))
      }
    },

    render: function () {
      View.prototype.render.apply(this, arguments)
    }
  })
})
