module('store node')

test("get all children", function() {
  var node = new lunr.StoreNode,
      childNode = node.at('a'),
      otherChildNode = node.at('a'),
      grandChildNode = childNode.at('a')

  childNode.push('childNode')
  otherChildNode.push('otherChildNode')
  grandChildNode.push('grandChildNode')

  equal(node.allChildren().length, 3)
  ok(node.allChildren().indexOf(childNode) > -1)
  ok(node.allChildren().indexOf(otherChildNode) > -1)
  ok(node.allChildren().indexOf(grandChildNode) > -1)
})
