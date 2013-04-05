/*global define:false*/

define([
  'views/base/view',
  'text!templates/shared/navigation.html',
  'jquery'
], function(View, template, $) {
  'use strict';

  return View.extend({
    template: template,
    className: 'pages heroku navigation',
    container: 'body > nav',

    render: function() {
      this.options.elements = $('h2').map(function() {
        var $headline = $(this)
          , $row      = $headline.parents('.row')

        return {
          url:   '#' + $row.first().attr('id'),
          title: $row.data('title') || $headline.text()
        }
      }).toArray()

      View.prototype.render.apply(this, arguments)

      this.jumpToAnchor()
    }
  })
})
