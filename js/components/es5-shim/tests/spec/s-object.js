describe('Object', function () {
    "use strict";

    describe("Object.keys", function () {
        var obj = {
            "str": "boz",
            "obj": { },
            "arr": [],
            "bool": true,
            "num": 42,
            "null": null,
            "undefined": undefined
        };

        var loopedValues = [];
        for (var k in obj) {
            loopedValues.push(k);
        }

        var keys = Object.keys(obj);
        it('should have correct length', function () {
            expect(keys.length).toBe(7);    
        });

        it('should return an Array', function () {
            expect(Array.isArray(keys)).toBe(true);    
        });
        
        it('should return names which are own properties', function () {
            keys.forEach(function (name) {
                expect(obj.hasOwnProperty(name)).toBe(true);
            });    
        });

        it('should return names which are enumerable', function () {
            keys.forEach(function (name) {
                expect(loopedValues.indexOf(name)).toNotBe(-1);
            }) 
        });
        
        it('should throw error for non object', function () {
            var e = {};
            expect(function () {
                try {
                    Object.keys(42)
                } catch (err) {
                    throw e;
                }
            }).toThrow(e);
        });
    });
 
	describe("Object.isExtensible", function () {
        var obj = { };

        it('should return true if object is extensible', function () {
            expect(Object.isExtensible(obj)).toBe(true);    
        });
		
        it('should return false if object is not extensible', function () {
            expect(Object.isExtensible(Object.preventExtensions(obj))).toBe(false);    
        });
        
        it('should return false if object is seal', function () {
            expect(Object.isExtensible(Object.seal(obj))).toBe(false);    
        });
		
        it('should return false if object is freeze', function () {
            expect(Object.isExtensible(Object.freeze(obj))).toBe(false);    
        });
		
        it('should throw error for non object', function () {
            var e1 = {};
            expect(function () {
                try {
                    Object.isExtensible(42)
                } catch (err) {
                    throw e1;
                }
            }).toThrow(e1);
        });
    });
 
});