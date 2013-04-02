/*global define:false*/

define([
  'views/base/view',
  'text!templates/shared/navigation.html',
  'jquery'
], function(View, template, $) {
  'use strict';

  return View.extend({
    template: template,
    className: 'changelog navigation',
    container: 'body > nav',

    render: function() {

      this.options.elements = [{
        title:   'Changelog',
        url:     '#',
        entries: $('h3').map(function() {
          var $headline = $(this)

          return {
            url:   '#' + $headline.parents('.row').first().attr('id'),
            title: $headline.text()
          }
        }).toArray().slice(0, 10)
      }]

      View.prototype.render.apply(this, arguments)

      this.jumpToAnchor()
    }
  })
})
