module('lunr.Index')

test("defining what fields to index", function () {
  var idx = new lunr.Index
  idx.field('foo')

  deepEqual(idx._fields[0], {name: 'foo', boost: 1})
})

test("giving a particular field a weighting", function () {
  var idx = new lunr.Index
  idx.field('foo', { boost: 10 })

  deepEqual(idx._fields[0], {name: 'foo', boost: 10})
})

test('default reference should be id', function () {
  var idx = new lunr.Index
  equal(idx._ref, 'id')
})

test("defining the reference field for the index", function () {
  var idx = new lunr.Index
  idx.ref('foo')

  deepEqual(idx._ref, 'foo')
})

test('adding a document to the index', function () {
  var idx = new lunr.Index,
      doc = {id: 1, body: 'this is a test'}

  idx.field('body')
  idx.add(doc)

  equal(idx.documentStore.length, 1)
  ok(!!idx.documentStore.get(1))
})

test('removing a document from the index', function () {
  var idx = new lunr.Index,
      doc = {id: 1, body: 'this is a test'}

  idx.field('body')
  equal(idx.documentStore.length, 0)

  idx.add(doc)
  equal(idx.documentStore.length, 1)

  idx.remove(doc)
  equal(idx.documentStore.length, 0)
})

test('updating a document', function () {
  var idx = new lunr.Index,
      doc = {id: 1, body: 'foo'}

  idx.field('body')
  idx.add(doc)
  equal(idx.documentStore.length, 1)
  ok(idx.tokenStore.has('foo'))

  doc.body = 'bar'
  idx.update(doc)

  equal(idx.documentStore.length, 1)
  ok(idx.tokenStore.has('bar'))
})
