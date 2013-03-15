/*global define:false*/

define([
  'views/base/view',
  'text!templates/documentation/navigation.html'
], function(View, template) {
  'use strict';

  return View.extend({
    template: template,
    className: 'documentation navigation',
    container: 'body > nav',
    autoRender: false,

    listen: {
      'documentation.index.skeleton_rendered mediator': function() {
        this.render()
      }
    }
  })
})
