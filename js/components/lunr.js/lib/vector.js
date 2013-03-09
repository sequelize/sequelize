/*!
 * lunr.Vector
 * Copyright (C) @YEAR Oliver Nightingale
 */

/**
 * lunr.Vectors wrap arrays and add vector related operations for the array
 * elements.
 *
 * @constructor
 * @param {Array} elements Elements that make up the vector.
 */
lunr.Vector = function (elements) {
  this.elements = elements

  for (var i = 0; i < elements.length; i++) {
    if (!(i in this.elements)) this.elements[i] = 0
  }
}

/**
 * Calculates the magnitude of this vector.
 *
 * @returns {Number}
 * @memberOf Vector
 */
lunr.Vector.prototype.magnitude = function () {
  if (this._magnitude) return this._magnitude

  var sumOfSquares = 0,
      elems = this.elements,
      len = elems.length,
      magnitude, el

  for (var i = 0; i < len; i++) {
    el = elems[i]
    sumOfSquares += el * el
  };

  return this._magnitude = Math.sqrt(sumOfSquares)
}

/**
 * Calculates the dot product of this vector and another vector.
 *
 * @param {lunr.Vector} otherVector The vector to compute the dot product with.
 * @returns {Number}
 * @memberOf Vector
 */
lunr.Vector.prototype.dot = function (otherVector) {
  var elem1 = this.elements,
      elem2 = otherVector.elements,
      length = elem1.length,
      dotProduct = 0

  for (var i = 0; i < length; i++) {
    dotProduct += elem1[i] * elem2[i]
  };

  return dotProduct
}

/**
 * Calculates the cosine similarity between this vector and another
 * vector.
 *
 * @param {lunr.Vector} otherVector The other vector to calculate the
 * similarity with.
 * @returns {Number}
 * @memberOf Vector
 */
lunr.Vector.prototype.similarity = function (otherVector) {
  return this.dot(otherVector) / (this.magnitude() * otherVector.magnitude())
}

/**
 * Converts this vector back into an array.
 *
 * @returns {Array}
 * @memberOf Vector
 */
lunr.Vector.prototype.toArray = function () {
  return this.elements
}
