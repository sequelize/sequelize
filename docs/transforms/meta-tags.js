'use strict';

module.exports = function transform($) {
  $('head').append('<meta name="viewport" content="width=device-width, initial-scale=1.0"/>');
};
