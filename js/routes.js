/*global define:false*/

define(function() {
  'use strict';

  return function(match) {
    match('',              'home#index')
    match('documentation', 'documentation#index')
  }
})
