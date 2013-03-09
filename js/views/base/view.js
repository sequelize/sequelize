/*global define:false, window:false*/

define([
  'underscore',
  'chaplin',
  'jquery',
  'lib/view_helper'
], function(_, Chaplin, $, ViewHelpers) {
  'use strict';

  var View = Chaplin.View.extend({
    container: 'body > .container',
    autoRender: true,

    getTemplateFunction: function() {
      var template = this.template
        , templateFunc = null

      if (typeof template === 'string') {
        templateFunc = function(obj) {
          return _.template(template, $.extend({}, ViewHelpers, obj, this.options))
        }.bind(this)

        this.constructor.prototype.template = templateFunc
      } else {
        templateFunc = template
      }

      return templateFunc
    },

    render: function() {
      $(this.container).empty()
      Chaplin.View.prototype.render.apply(this, arguments)
      window.setTimeout(function() {
        this.trigger('rendered')
      }.bind(this), 1)
    }
  })

  return View
})
