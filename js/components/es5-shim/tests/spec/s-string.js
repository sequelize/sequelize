describe('String', function() {
    "use strict";
    describe("trim", function() {
        var test = "\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFFHello, World!\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF";

        it('trims all ES5 whitespace', function() {
            expect(test.trim()).toEqual("Hello, World!");
            expect(test.trim().length).toEqual(13);
        });
    });

    describe("split", function() {
        var test = "ab";

        it('If "separator" is undefined must return Array with one String - "this" string', function() {
            expect(test.split()).toEqual([test]);
            expect(test.split(void 0)).toEqual([test]);
        });

        it('If "separator" is undefined and "limit" set to 0 must return Array[]', function() {
            expect(test.split(void 0, 0)).toEqual([]);
        });
    });
});
