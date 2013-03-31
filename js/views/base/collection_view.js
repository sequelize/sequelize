/*global define:false, window:false*/

define([
  'chaplin',
  'views/base/view'
], function(Chaplin, View) {
  'use strict';

  var CollectionView = Chaplin.CollectionView.extend({
    autoRender:          true,
    getTemplateFunction: View.prototype.getTemplateFunction,
    container:           'body > .container',

    render: function() {
      Chaplin.CollectionView.prototype.render.apply(this, arguments)

      window.setTimeout(function() {
        this.trigger('render')
      }.bind(this), 1)
    }

  })

  return CollectionView
})
