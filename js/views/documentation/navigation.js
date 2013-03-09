/*global define:false*/

define([
  'views/base/view',
  'text!templates/documentation/navigation.html'
], function(View, template) {
  'use strict';

  return View.extend({
    template: template,
    className: 'documentation navigation',
    container: 'body > nav'
  })
})
