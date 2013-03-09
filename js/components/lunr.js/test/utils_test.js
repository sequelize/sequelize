module('utils')

test('wrapping in an array', function() {
  same(lunr.utils.arrayWrap(1), [1])
  same(lunr.utils.arrayWrap('a'), ['a'])
  same(lunr.utils.arrayWrap({}), [{}])
  same(lunr.utils.arrayWrap([]), [])
  same(lunr.utils.arrayWrap([1]), [1])
  same(lunr.utils.arrayWrap(undefined), [])
  same(lunr.utils.arrayWrap(null), [])
})

test('flattening an array', function () {
  same(lunr.utils.flatten([1,2,3]), [1,2,3])
  same(lunr.utils.flatten([1, [2, [3]]]), [1,2,3])
})
