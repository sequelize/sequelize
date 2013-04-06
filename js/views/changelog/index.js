/*global define:false*/

define([
  'views/base/collection_view',
  'text!templates/changelog/index.html',
  'views/changelog/item',
  'jquery'
], function(View, template, ItemView, $) {
  'use strict';

  return View.extend({
    className:  'changelog index',
    itemView:   ItemView,
    autoRender: false,

    listen: {
      'render': function() {
        this.$el.prepend($(template))
      }
    },

    render: function () {
      View.prototype.render.apply(this, arguments)
    }
  })
})
