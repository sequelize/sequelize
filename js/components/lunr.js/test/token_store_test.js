module('lunr.TokenStore')

test('adding a token to the store', function () {
  var store = new lunr.TokenStore,
      doc = { ref: 123, tf: 1 },
      token = 'foo'

  store.add(token, doc)

  ok(store.root['f']['o']['o']['docs'][123] === doc)
  equal(store.length, 1)
})

test('adding another document to the token', function () {
  var store = new lunr.TokenStore,
      doc1 = { ref: 123, tf: 1 },
      doc2 = { ref: 456, tf: 1 },
      token = 'foo'

  store.add(token, doc1)
  store.add(token, doc2)

  ok(store.root['f']['o']['o']['docs'][123] === doc1)
  ok(store.root['f']['o']['o']['docs'][456] === doc2)
})

test('checking if a token exists in the store', function () {
  var store = new lunr.TokenStore,
      doc = { ref: 123, tf: 1 },
      token = 'foo'

  store.add(token, doc)

  ok(store.has(token))
})

test('checking if a token does not exist in the store', function () {
  var store = new lunr.TokenStore,
      doc = { ref: 123, tf: 1 },
      token = 'foo'

  ok(!store.has('bar'))
  store.add(token, doc)
  ok(!store.has('bar'))
})

test('retrieving items from the store', function () {
  var store = new lunr.TokenStore,
      doc = { ref: 123, tf: 1 },
      token = 'foo'

  store.add(token, doc)
  deepEqual(store.get(token), {
    '123': doc
  })
})

test('retrieving items that do not exist in the store', function () {
  var store = new lunr.TokenStore

  deepEqual(store.get('foo'), {})
})

test('removing a document from the token store', function () {
  var store = new lunr.TokenStore,
      doc = { ref: 123, tf: 1 }

  deepEqual(store.get('foo'), {})
  store.add('foo', doc)
  deepEqual(store.get('foo'), {
    '123': doc
  })

  store.remove('foo', 123)
  deepEqual(store.get('foo'), {})
})

test('removing a document that is not in the store', function () {
  var store = new lunr.TokenStore,
      doc1 = { ref: 123, tf: 1 },
      doc2 = { ref: 567, tf: 1 }

  store.add('foo', doc1)
  store.add('bar', doc2)
  store.remove('foo', 456)

  deepEqual(store.get('foo'), { 123: doc1 })
})

test('removing a document from a key that does not exist', function () {
  var store = new lunr.TokenStore

  store.remove('foo', 123)
  ok(!store.has('foo'))
})

test('expand a token into all descendent tokens', function () {
  var store = new lunr.TokenStore,
      doc = { ref: 123, tf: 1 }

  store.add('hell', doc)
  store.add('hello', doc)
  store.add('help', doc)
  store.add('held', doc)
  store.add('foo', doc)
  store.add('bar', doc)

  var tokens = store.expand('hel')
  deepEqual(tokens, ['hell', 'hello', 'help', 'held'])
})
