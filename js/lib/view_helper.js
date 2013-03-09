/*global define:false*/

define([
  'chaplin',
  'lib/utils',
  'jquery'
], function(Chaplin, utils, $) {
  'use strict';

  return {
    fixCodeIndentation: function($html) {
      $html.find('code[class*="language-"]').each(function() {
        var $code       = $(this)
          , content     = $code.html()
          , lines       = content.split('\n')
          , indentation = lines[1].match(/(\s+)/)[1].length

        content = lines.reduce(function(content, line, i) {
          if ((line.trim() !== '') || (i !== 0)) {
            content.push(line.replace(/\s+$/, '').replace(new RegExp("^\\s{" + indentation + "}"), ''))
          }

          return content
        }, []).join('\n')

        $code.html(content)
      })

      return $html
    }
  }
})
