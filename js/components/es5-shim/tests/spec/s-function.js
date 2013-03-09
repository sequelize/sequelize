
describe('Function', function() {
    "use strict";
    describe('bind', function() {
        var actual, expected,
            testSubject;
        
        testSubject = {
            push: function(o) {
                this.a.push(o);
            }
        };
        
        function func() {
            Array.prototype.forEach.call(arguments, function(a) {
                this.push(a);
            }, this);
            return this;
        };
        
        beforeEach(function() {
            actual = [];
            testSubject.a = [];
        });
        
        it('binds properly without a context', function() {
            var context;
            testSubject.func = function() {
                context = this;
            }.bind();
            testSubject.func();
            expect(context).toBe(function() {return this}.call());
        });
        it('binds properly without a context, and still supplies bound arguments', function() {
            var a, context;
            testSubject.func = function() {
                a = Array.prototype.slice.call(arguments);
                context = this;
            }.bind(undefined, 1,2,3);
            testSubject.func(1,2,3);
            expect(a).toEqual([1,2,3,1,2,3]);
            expect(context).toBe(function() {return this}.call());
        });
        it('binds a context properly', function() {
            testSubject.func = func.bind(actual);
            testSubject.func(1,2,3);
            expect(actual).toEqual([1,2,3]);
            expect(testSubject.a).toEqual([]);
        });
        it('binds a context and supplies bound arguments', function() {
            testSubject.func = func.bind(actual, 1,2,3);
            testSubject.func(4,5,6);
            expect(actual).toEqual([1,2,3,4,5,6]);
            expect(testSubject.a).toEqual([]);
        });
        
        it('returns properly without binding a context', function() {
            testSubject.func = function() {
                return this;
            }.bind();
            var context = testSubject.func();
            expect(context).toBe(function() {return this}.call());
        });
        it('returns properly without binding a context, and still supplies bound arguments', function() {
            var context;
            testSubject.func = function() {
                context = this;
                return Array.prototype.slice.call(arguments);
            }.bind(undefined, 1,2,3);
            actual = testSubject.func(1,2,3);
            expect(context).toBe(function() {return this}.call());
            expect(actual).toEqual([1,2,3,1,2,3]);
        });
        it('returns properly while binding a context properly', function() {
            var ret;
            testSubject.func = func.bind(actual);
            ret = testSubject.func(1,2,3);
            expect(ret).toBe(actual);
            expect(ret).not.toBe(testSubject);
        });
        it('returns properly while binding a context and supplies bound arguments', function() {
            var ret;
            testSubject.func = func.bind(actual, 1,2,3);
            ret = testSubject.func(4,5,6);
            expect(ret).toBe(actual);
            expect(ret).not.toBe(testSubject);
        });
        it('passes the correct arguments as a constructor', function() {
            var ret, expected = { name: "Correct" };
            testSubject.func = function(arg) {
                return arg;
            }.bind({ name: "Incorrect" });
            ret = new testSubject.func(expected);
            expect(ret).toBe(expected);
        });
        it('returns the return value of the bound function when called as a constructor', function () {
            var oracle = [1, 2, 3];
            var subject = function () {
                return oracle;
            }.bind(null);
            var result = new subject;
            expect(result).toBe(oracle);
        });
        it('returns the correct value if constructor returns primitive', function() {
            var oracle = [1, 2, 3];
            var subject = function () {
                return oracle;
            }.bind(null);
            var result = new subject;
            expect(result).toBe(oracle);

            oracle = {};
            result = new subject;
            expect(result).toBe(oracle);

            oracle = function(){};
            result = new subject;
            expect(result).toBe(oracle);

            oracle = "asdf";
            result = new subject;
            expect(result).not.toBe(oracle);

            oracle = null;
            result = new subject;
            expect(result).not.toBe(oracle);

            oracle = true;
            result = new subject;
            expect(result).not.toBe(oracle);

            oracle = 1;
            result = new subject;
            expect(result).not.toBe(oracle);
        });
        it('returns the value that instance of original "class" when called as a constructor', function() {
            var classA = function(x) {
                this.name = x || "A";
            }
            var classB = classA.bind(null, "B");
            
            var result = new classB;
            expect(result instanceof classA).toBe(true);
            expect(result instanceof classB).toBe(true);
        });
    });
});
