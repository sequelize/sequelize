/*global define:false*/

define([
  'views/base/view',
  'text!templates/changelog/item.html'
], function(View, template) {
  'use strict';

  return View.extend({
    template: template,
    className: 'changelog item',

    listen: {
      'render': function() {
        console.log('rendered')
      }
    }
  })
})
