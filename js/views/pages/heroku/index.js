/*global define:false*/

define([
  'chaplin',
  'views/base/view',
  'text!templates/pages/heroku.html'
], function(Chaplin, View, template) {
  'use strict';

  return View.extend({
    template:  template,
    className: 'pages heroku index',
    autoRender: false
  })
})
