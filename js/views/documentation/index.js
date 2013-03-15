/*global define:false, Prism:false, window:false, require:false, document:false*/

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

              $('[data-spy="scroll"]').each(function () {
                $(this).scrollspy('refresh')
              })

              ;(function() {
                // fix sub nav on scroll
                var $win = $(window)
                  , $body = $('body')
                  , $nav = $('.subnav')
                  , navHeight = $('.navbar').first().height()
                  , subnavHeight = $('.subnav').first().height()
                  , subnavTop = $('.subnav').length && $('.subnav').offset().top - navHeight
                  , marginTop = parseInt($body.css('margin-top'), 10)
                  , isFixed = 0

                processScroll();

                $win.on('scroll', processScroll);

                function processScroll() {
                  var scrollTop = $win.scrollTop();

                  if (scrollTop >= subnavTop && !isFixed) {
                    isFixed = 1;
                    $nav.addClass('subnav-fixed');
                    $body.css('margin-top', marginTop + subnavHeight + 'px');
                  } else if (scrollTop <= subnavTop && isFixed) {
                    isFixed = 0;
                    $nav.removeClass('subnav-fixed');
                    $body.css('margin-top', marginTop + 'px');
                  }
                }
              })()

              if (!!window.anchor && !!document.location.href.match(/#$/)) {
                document.location.href = document.location.href.replace('#', '#' + window.anchor)
              }
            }, 50)
          })
        })
      })
    }
  })
})
