var Utils = require('../lib/utils')

describe('Utils', function() {
  describe('removeCommentsFromFunctionString', function() {
    it("removes line comments at the start of a line", function() {
      var functionWithLineComments = function() {
        // noot noot
      }

      var result = Utils.removeCommentsFromFunctionString(functionWithLineComments.toString())
      expect(result).toNotMatch(/.*noot.*/)
    })

    it("removes lines comments in the middle of a line", function() {
      var functionWithLineComments = function() {
        alert(1) // noot noot
      }

      var result = Utils.removeCommentsFromFunctionString(functionWithLineComments.toString())
      expect(result).toNotMatch(/.*noot.*/)
    })

    it("removes range comments", function() {
      var s = function() {
        alert(1) /*
          noot noot
        */
        alert(2) /*
          foo
        */
      }.toString()

      var result = Utils.removeCommentsFromFunctionString(s)
      expect(result).toNotMatch(/.*noot.*/)
      expect(result).toNotMatch(/.*foo.*/)
      expect(result).toMatch(/.*alert\(2\).*/)
    })
  })

  describe('argsArePrimaryKeys', function() {
    it("doesn't detect primary keys if primareyKeys and values have different lengths", function() {
      expect(Utils.argsArePrimaryKeys([1,2,3], [1])).toBeFalsy()
    })

    it("doesn't detect primary keys if primary keys are hashes or arrays", function() {
      expect(Utils.argsArePrimaryKeys([[]], [1])).toBeFalsy()
    })

    it('detects primary keys if length is correct and data types are matching', function() {
      expect(Utils.argsArePrimaryKeys([1,2,3], ["INTEGER", "INTEGER", "INTEGER"])).toBeTruthy()
    })

    it("detects primary keys if primary keys are dates and lengths are matching", function() {
      expect(Utils.argsArePrimaryKeys([new Date()], ['foo'])).toBeTruthy()
    })
  })

  describe('underscore', function() {
    describe('underscoredIf', function() {
      it('is defined', function() {
        expect(Utils._.underscoredIf).toBeDefined()
      })

      it('underscores if second param is true', function() {
        expect(Utils._.underscoredIf('fooBar', true)).toEqual('foo_bar')
      })

      it("doesn't underscore if second param is false", function() {
        expect(Utils._.underscoredIf('fooBar', false)).toEqual('fooBar')
      })
    })

    describe('camelizeIf', function() {
      it('is defined', function() {
        expect(Utils._.camelizeIf).toBeDefined()
      })

      it('camelizes if second param is true', function() {
        expect(Utils._.camelizeIf('foo_bar', true)).toEqual('fooBar')
      })

      it("doesn't camelize if second param is false", function() {
        expect(Utils._.underscoredIf('fooBar', true)).toEqual('foo_bar')
      })
    })
  })
  
  describe('isHash', function() {
    it('doesn\'t match arrays', function() {
      expect(Utils.isHash([])).toBeFalsy();
    });
    it('doesn\'t match null', function() {
      expect(Utils.isHash(null)).toBeFalsy();
    });
    it('matches plain objects', function() {
    	var values = {
    	  'name': {
    	    'first': 'Foo',
    	    'last': 'Bar'
    	  }
    	};
      expect(Utils.isHash(values)).toBeTruthy();
    });
    it('matches plain objects with length property/key', function() {
      var values = {
    	  'name': {
    	    'first': 'Foo',
    	    'last': 'Bar'
    	  },
    	  'length': 1
    	};
    	expect(Utils.isHash(values)).toBeTruthy();
    });
  });

  describe('format', function() {
    it('should format where clause correctly when the value is truthy', function() {
      var where = ['foo = ?', 1];
      expect(Utils.format(where)).toEqual('foo = 1');
    });

    it('should format where clause correctly when the value is falsy', function() {
      var where = ['foo = ?', 0];
      expect(Utils.format(where)).toEqual('foo = 0');
    });
  });
})
