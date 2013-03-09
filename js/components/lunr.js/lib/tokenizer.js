/*!
 * lunr.tokenizer
 * Copyright (C) @YEAR Oliver Nightingale
 */

/**
 * A function for splitting a string into tokens ready to be insterted into
 * the search index.
 *
 * @module
 * @param {String} str The string to convert into tokens
 * @returns {Array}
 */
lunr.tokenizer = function (str) {
  if (Array.isArray(str)) return str

  var trailingPunctuationRegex = /[\!|\,|\.|\?]+$/,
      whiteSpaceSplitRegex = /\s+/

  return str.split(whiteSpaceSplitRegex).map(function (token) {
    return token.replace(/^\W+/, '').replace(/\W+$/, '').toLowerCase()
  })
}
