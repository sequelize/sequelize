/*global define:false, Prism:false, window:false, require:false*/

define([
  'views/base/view',
  'text!templates/documentation/index.html',
  'jquery',
  'lib/view_helper'
], function(View, template, $, ViewHelper) {
  'use strict';

  return View.extend({
    template: template,
    className: 'documentation index',

    initialize: function() {
      this.on('rendered', function() {
        // get all sections on the page and create an array with the paths to its templates
        var ids       = $('section').map(function() { return $(this).attr('id') }).toArray()
          , filenames = ids.map(function(id) { return 'text!templates/documentation/sections/' + id + '.html' })

        // require the templates ...
        require(filenames, function() {
          var templates = arguments

          // ... in assign the html to the DOM
          ids.forEach(function(id, i) {
            var html = ViewHelper.fixCodeIndentation($(templates[i]))
            $('section#' + id).html(html)

            // wait a tiny bit and highlight the code
            window.setTimeout(function() {
              Prism.highlightAll()
            }, 50)
          })
        })
      })
    }
  })
})
