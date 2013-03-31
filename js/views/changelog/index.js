/*global define:false*/

define([
  'views/base/collection_view',
  'views/changelog/item'
], function(View, ItemView) {
  'use strict';

  return View.extend({
    className: 'changelog index',
    itemView:  ItemView,

    render: function () {
      console.log(this)
      View.prototype.render.apply(this, arguments)
    }
  })
})
