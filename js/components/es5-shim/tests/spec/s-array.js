describe('Array', function() {
    var testSubject;
    beforeEach(function() {
        testSubject = [2, 3, undefined, true, 'hej', null, false, 0];
        delete testSubject[1];
    });
    function createArrayLikeFromArray(arr) {
        var o = {};
        Array.prototype.forEach.call(arr, function(e, i) {
            o[i]=e;
        });
        o.length = arr.length;
        return o;
    };
    
    describe('forEach', function() {
        "use strict";
        var expected, actual;
        
        beforeEach(function() {
            expected = {0:2, 2: undefined, 3:true, 4: 'hej', 5:null, 6:false, 7:0 };
            actual = {};
        });
        it('should pass the right parameters', function() {
            var callback = jasmine.createSpy('callback'),
                array = ['1'];
            array.forEach(callback);
            expect(callback).toHaveBeenCalledWith('1', 0, array);
        });
        it('should not affect elements added to the array after it has begun', function() {
            var arr = [1,2,3],
                i = 0;
            arr.forEach(function(a) {
                i++;
                arr.push(a+3);
            });
            expect(arr).toEqual([1,2,3,4,5,6]);
            expect(i).toBe(3);
        });
        
        it('should set the right context when given none', function() {
            var context;
            [1].forEach(function() {context = this;});
            expect(context).toBe(function() {return this}.call());
        });
        it('should iterate all', function() {
            testSubject.forEach(function(obj, index) {
                actual[index] = obj;
            });
            expect(actual).toExactlyMatch(expected);
        });
        it('should iterate all using a context', function() {
            var o = { a: actual };
    
            testSubject.forEach(function(obj, index) {
                this.a[index] = obj;
            }, o);
            expect(actual).toExactlyMatch(expected);
        });
        
        it('should iterate all in an array-like object', function() {
            var ts = createArrayLikeFromArray(testSubject);
            Array.prototype.forEach.call(ts, function(obj, index) {
                actual[index] = obj;
            });
            expect(actual).toExactlyMatch(expected);
        });
        it('should iterate all in an array-like object using a context', function() {
            var ts = createArrayLikeFromArray(testSubject),
                o = { a: actual };
            
            Array.prototype.forEach.call(ts, function(obj, index) {
                this.a[index] = obj;
            }, o);
            expect(actual).toExactlyMatch(expected);
        });

        describe('strings', function() {
            var str = 'Hello, World!',
                toString = Object.prototype.toString;
            it('should iterate all in a string', function() {
                actual = [];
                Array.prototype.forEach.call(str, function(item, index) {
                    actual[index] = item;
                });
                expect(actual).toExactlyMatch(str.split(''));
            });
            it('should iterate all in a string using a context', function() {
                actual = [];
                var o = { a: actual };
                Array.prototype.forEach.call(str, function(item, index) {
                    this.a[index] = item;
                }, o);
                expect(actual).toExactlyMatch(str.split(''));
            });
            it('should have String object for third argument of callback', function() {
                Array.prototype.forEach.call(str, function(item, index, obj) {
                    actual = obj;
                });
                expect(typeof actual).toBe("object");
                expect(toString.call(actual)).toBe("[object String]");
            });
        });
    });
    describe('some', function() {
        var actual, expected, numberOfRuns;
        
        beforeEach(function() {
            expected = {0:2, 2: undefined, 3:true };
            actual = {};
            numberOfRuns = 0;
        });
        
        it('should pass the correct values along to the callback', function() {
            var callback = jasmine.createSpy('callback');
            var array = ['1'];
            array.some(callback);
            expect(callback).toHaveBeenCalledWith('1', 0, array);
        });
        it('should not affect elements added to the array after it has begun', function() {
            var arr = [1,2,3],
                i = 0;
            arr.some(function(a) {
                i++;
                arr.push(a+3);
                return i > 3;
            });
            expect(arr).toEqual([1,2,3,4,5,6]);
            expect(i).toBe(3);
        });
        it('should set the right context when given none', function() {
            var context;
            [1].some(function() {context = this;});
            expect(context).toBe(function() {return this}.call());
        });
        
        it('should return false if it runs to the end', function() {
            actual = testSubject.some(function() {});
            expect(actual).toBeFalsy();
        });
        it('should return true if it is stopped somewhere', function() {
            actual = testSubject.some(function() { return true; });
            expect(actual).toBeTruthy();
        });
        it('should return false if there are no elements', function() {
            actual = [].some(function() { return true; });
            expect(actual).toBeFalsy();
        });
        
        it('should stop after 3 elements', function() {
            testSubject.some(function(obj, index) {
                actual[index] = obj;
                numberOfRuns += 1;
                if(numberOfRuns == 3) {
                    return true;
                }
                return false;
            });
            expect(actual).toExactlyMatch(expected);
        });
        it('should stop after 3 elements using a context', function() {
            var o = { a: actual };
            testSubject.some(function(obj, index) {
                this.a[index] = obj;
                numberOfRuns += 1;
                if(numberOfRuns == 3) {
                    return true;
                }
                return false;
            }, o);
            expect(actual).toExactlyMatch(expected);
        });
    
        it('should stop after 3 elements in an array-like object', function() {
            var ts = createArrayLikeFromArray(testSubject);
            Array.prototype.some.call(ts, function(obj, index) {
                actual[index] = obj;
                numberOfRuns += 1;
                if(numberOfRuns == 3) {
                    return true;
                }
                return false;
            });
            expect(actual).toExactlyMatch(expected);
        });
        it('should stop after 3 elements in an array-like object using a context', function() {
            var ts = createArrayLikeFromArray(testSubject);
            var o = { a: actual };
            Array.prototype.some.call(ts, function(obj, index) {
                this.a[index] = obj;
                numberOfRuns += 1;
                if(numberOfRuns == 3) {
                    return true;
                }
                return false;
            }, o);
            expect(actual).toExactlyMatch(expected);
        });
    });
    describe('every', function() {
        var actual, expected, numberOfRuns;
        
        beforeEach(function() {
            expected = {0:2, 2: undefined, 3:true };
            actual = {};
            numberOfRuns = 0;
        });
        
        it('should pass the correct values along to the callback', function() {
            var callback = jasmine.createSpy('callback');
            var array = ['1'];
            array.every(callback);
            expect(callback).toHaveBeenCalledWith('1', 0, array);
        });
        it('should not affect elements added to the array after it has begun', function() {
            var arr = [1,2,3],
                i = 0;
            arr.every(function(a) {
                i++;
                arr.push(a+3);
                return i <= 3;
            });
            expect(arr).toEqual([1,2,3,4,5,6]);
            expect(i).toBe(3);
        });
        it('should set the right context when given none', function() {
            var context;
            [1].every(function() {context = this;});
            expect(context).toBe(function() {return this}.call());
        });
        
        it('should return true if the array is empty', function() {
            actual = [].every(function() { return true; });
            expect(actual).toBeTruthy();
            
            actual = [].every(function() { return false; });
            expect(actual).toBeTruthy();
        });
        it('should return true if it runs to the end', function() {
            actual = [1,2,3].every(function() { return true; });
            expect(actual).toBeTruthy();
        });
        it('should return false if it is stopped before the end', function() {
            actual = [1,2,3].every(function() { return false; });
            expect(actual).toBeFalsy();
        });
        
        it('should return after 3 elements', function() {
            testSubject.every(function(obj, index) {
                actual[index] = obj;
                numberOfRuns += 1;
                if(numberOfRuns == 3) {
                    return false;
                }
                return true;
            });
            expect(actual).toExactlyMatch(expected);
        });
        it('should stop after 3 elements using a context', function() {
            var o = { a: actual };
            testSubject.every(function(obj, index) {
                this.a[index] = obj;
                numberOfRuns += 1;
                if(numberOfRuns == 3) {
                    return false;
                }
                return true;
            }, o);
            expect(actual).toExactlyMatch(expected);
        });
    
        it('should stop after 3 elements in an array-like object', function() {
            var ts = createArrayLikeFromArray(testSubject);
            Array.prototype.every.call(ts, function(obj, index) {
                actual[index] = obj;
                numberOfRuns += 1;
                if(numberOfRuns == 3) {
                    return false;
                }
                return true;
            });
            expect(actual).toExactlyMatch(expected);
        });
        it('should stop after 3 elements in an array-like object using a context', function() {
            var ts = createArrayLikeFromArray(testSubject);
            var o = { a: actual };
            Array.prototype.every.call(ts, function(obj, index) {
                this.a[index] = obj;
                numberOfRuns += 1;
                if(numberOfRuns == 3) {
                    return false;
                }
                return true;
            }, o);
            expect(actual).toExactlyMatch(expected);
        });
    });
    
    describe('indexOf', function() {
        "use strict";
        var actual, expected, testSubject;
        
        beforeEach(function() {
            testSubject = [2, 3, undefined, true, 'hej', null, 2, false, 0];
            delete testSubject[1];
    
        });
    
        it('should find the element', function() {
            expected = 4;
            actual = testSubject.indexOf('hej');
            expect(actual).toEqual(expected);
        });
        it('should not find the element', function() {
            expected = -1;
            actual = testSubject.indexOf('mus');
            expect(actual).toEqual(expected);
        });
        it('should find undefined as well', function() {
            expected = -1;
            actual = testSubject.indexOf(undefined);
            expect(actual).not.toEqual(expected);
        });
        it('should skip unset indexes', function() {
            expected = 2;
            actual = testSubject.indexOf(undefined);
            expect(actual).toEqual(expected);
        });
        it('should use a strict test', function() {
            actual = testSubject.indexOf(null);
            expect(actual).toEqual(5);
            
            actual = testSubject.indexOf('2');
            expect(actual).toEqual(-1);
        });
        it('should skip the first if fromIndex is set', function() {
            expect(testSubject.indexOf(2, 2)).toEqual(6);
            expect(testSubject.indexOf(2, 0)).toEqual(0);
            expect(testSubject.indexOf(2, 6)).toEqual(6);
        });
        it('should work with negative fromIndex', function() {
            expect(testSubject.indexOf(2, -3)).toEqual(6);
            expect(testSubject.indexOf(2, -9)).toEqual(0);
        });
        it('should work with fromIndex being greater than the length', function() {
            expect(testSubject.indexOf(0, 20)).toEqual(-1);
        });
        it('should work with fromIndex being negative and greater than the length', function() {
            expect(testSubject.indexOf('hej', -20)).toEqual(4);
        });
        
        describe('Array-like', function ArrayLike() {
            var indexOf = Array.prototype.indexOf,
                testAL;
            beforeEach(function beforeEach() {
                testAL = {};
                testSubject = [2, 3, undefined, true, 'hej', null, 2, false, 0];
                testSubject.forEach(function (o,i) {
                    testAL[i] = o;
                });
                testAL.length = testSubject.length;
            });
            it('should find the element (array-like)', function() {
                expected = 4;
                actual = indexOf.call(testAL, 'hej');
                expect(actual).toEqual(expected);
            });
            it('should not find the element (array-like)', function() {
                expected = -1;
                actual = indexOf.call(testAL, 'mus');
                expect(actual).toEqual(expected);
            });
            it('should find undefined as well (array-like)', function() {
                expected = -1;
                actual = indexOf.call(testAL, undefined);
                expect(actual).not.toEqual(expected);
            });
            it('should skip unset indexes (array-like)', function() {
                expected = 2;
                actual = indexOf.call(testAL, undefined);
                expect(actual).toEqual(expected);
            });
            it('should use a strict test (array-like)', function() {
                actual = Array.prototype.indexOf.call(testAL, null);
                expect(actual).toEqual(5);
                
                actual = Array.prototype.indexOf.call(testAL, '2');
                expect(actual).toEqual(-1);
            });
            it('should skip the first if fromIndex is set (array-like)', function() {
                expect(indexOf.call(testAL, 2, 2)).toEqual(6);
                expect(indexOf.call(testAL, 2, 0)).toEqual(0);
                expect(indexOf.call(testAL, 2, 6)).toEqual(6);
            });
            it('should work with negative fromIndex (array-like)', function() {
                expect(indexOf.call(testAL, 2, -3)).toEqual(6);
                expect(indexOf.call(testAL, 2, -9)).toEqual(0);
            });
            it('should work with fromIndex being greater than the length (array-like)', function() {
                expect(indexOf.call(testAL, 0, 20)).toEqual(-1);
            });
            it('should work with fromIndex being negative and greater than the length (array-like)', function() {
                expect(indexOf.call(testAL, 'hej', -20)).toEqual(4);
            });
        });
    });
    describe('lastIndexOf', function() {
        "use strict";
        var actual, expected, testSubject, testAL;
        
        beforeEach(function() {
            testSubject = [2, 3, undefined, true, 'hej', null, 2, 3, false, 0];
            delete testSubject[1];
            delete testSubject[7];
        });
        describe('Array', function() {
            it('should find the element', function() {
                expected = 4;
                actual = testSubject.lastIndexOf('hej');
                expect(actual).toEqual(expected);
            });
            it('should not find the element', function() {
                expected = -1;
                actual = testSubject.lastIndexOf('mus');
                expect(actual).toEqual(expected);
            });
            it('should find undefined as well', function() {
                expected = -1;
                actual = testSubject.lastIndexOf(undefined);
                expect(actual).not.toEqual(expected);
            });
            it('should skip unset indexes', function() {
                expected = 2;
                actual = testSubject.lastIndexOf(undefined);
                expect(actual).toEqual(expected);
            });
            it('should use a strict test', function() {
                actual = testSubject.lastIndexOf(null);
                expect(actual).toEqual(5);
                
                actual = testSubject.lastIndexOf('2');
                expect(actual).toEqual(-1);
            });
            it('should skip the first if fromIndex is set', function() {
                expect(testSubject.lastIndexOf(2, 2)).toEqual(0);
                expect(testSubject.lastIndexOf(2, 0)).toEqual(0);
                expect(testSubject.lastIndexOf(2, 6)).toEqual(6);
            });
            it('should work with negative fromIndex', function() {
                expect(testSubject.lastIndexOf(2, -3)).toEqual(6);
                expect(testSubject.lastIndexOf(2, -9)).toEqual(0);
            });
            it('should work with fromIndex being greater than the length', function() {
                expect(testSubject.lastIndexOf(2, 20)).toEqual(6);
            });
            it('should work with fromIndex being negative and greater than the length', function() {
                expect(testSubject.lastIndexOf(2, -20)).toEqual(-1);
            });
        });
    
        describe('Array like', function() {
            var lastIndexOf = Array.prototype.lastIndexOf,
                testAL;
            beforeEach(function() {
                testAL = {};
                testSubject.forEach(function (o,i) {
                    testAL[i] = o;
                });
                testAL.length = testSubject.length;
            });
            it('should find the element (array-like)', function() {
                expected = 4;
                actual = lastIndexOf.call(testAL, 'hej');
                expect(actual).toEqual(expected);
            });
            it('should not find the element (array-like)', function() {
                expected = -1;
                actual = lastIndexOf.call(testAL, 'mus');
                expect(actual).toEqual(expected);
            });
            it('should find undefined as well (array-like)', function() {
                expected = -1;
                actual = lastIndexOf.call(testAL, undefined);
                expect(actual).not.toEqual(expected);
            });
            it('should skip unset indexes (array-like)', function() {
                expected = 2;
                actual = lastIndexOf.call(testAL, undefined);
                expect(actual).toEqual(expected);
            });
            it('should use a strict test (array-like)', function() {
                actual = lastIndexOf.call(testAL, null);
                expect(actual).toEqual(5);
                
                actual = lastIndexOf.call(testAL, '2');
                expect(actual).toEqual(-1);
            });
            it('should skip the first if fromIndex is set', function() {
                expect(lastIndexOf.call(testAL, 2, 2)).toEqual(0);
                expect(lastIndexOf.call(testAL, 2, 0)).toEqual(0);
                expect(lastIndexOf.call(testAL, 2, 6)).toEqual(6);
            });
            it('should work with negative fromIndex', function() {
                expect(lastIndexOf.call(testAL, 2, -3)).toEqual(6);
                expect(lastIndexOf.call(testAL, 2, -9)).toEqual(0);
            });
            it('should work with fromIndex being greater than the length', function() {
                expect(lastIndexOf.call(testAL, 2, 20)).toEqual(6);
            });
            it('should work with fromIndex being negative and greater than the length', function() {
                expect(lastIndexOf.call(testAL, 2, -20)).toEqual(-1);
            });
        });
    });
    
    describe('filter', function() {
        var filteredArray,
            callback = function callback(o, i, arr) {
                return (
                    i != 3 && i != 5
                );
            };
        
        beforeEach(function() {
            testSubject = [2, 3, undefined, true, 'hej', 3, null, false, 0];
            delete testSubject[1];
            filteredArray = [2, undefined, 'hej', null, false, 0];
        });
        describe('Array object', function() {

            it('should call the callback with the proper arguments', function() {
                var callback = jasmine.createSpy('callback'),
                    arr = ['1'];
                arr.filter(callback);
                expect(callback).toHaveBeenCalledWith('1', 0, arr);
            });
            it('should not affect elements added to the array after it has begun', function() {
                var arr = [1,2,3],
                    i = 0;
                arr.filter(function(a) {
                    i++;
                    if(i <= 4) {
                        arr.push(a+3);
                    }
                    return true;
                });
                expect(arr).toEqual([1,2,3,4,5,6]);
                expect(i).toBe(3);
            });
            it('should skip non-set values', function() {
                var passedValues = {};
                testSubject = [1,2,3,4];
                delete testSubject[1];
                testSubject.filter(function(o, i) {
                    passedValues[i] = o;
                    return true;
                });
                expect(passedValues).toExactlyMatch(testSubject);
            });
            it('should pass the right context to the filter', function() {
                var passedValues = {};
                testSubject = [1,2,3,4];
                delete testSubject[1];
                testSubject.filter(function(o, i) {
                    this[i] = o;
                    return true;
                }, passedValues);
                expect(passedValues).toExactlyMatch(testSubject);
            });
            it('should set the right context when given none', function() {
                var context;
                [1].filter(function() {context = this;});
                expect(context).toBe(function() {return this}.call());
            });
            it('should remove only the values for which the callback returns false', function() {
                var result = testSubject.filter(callback);
                expect(result).toExactlyMatch(filteredArray);
            });
            it('should leave the original array untouched', function() {
                var copy = testSubject.slice();
                testSubject.filter(callback);
                expect(testSubject).toExactlyMatch(copy);
            });
            it('should not be affected by same-index mutation', function () {
                var results = [1, 2, 3]
                .filter(function (value, index, array) {
                    array[index] = 'a';
                    return true;
                });
                expect(results).toEqual([1, 2, 3]);
            });
        });
        describe('Array like', function() {
            beforeEach(function() {
                testSubject = createArrayLikeFromArray(testSubject);
            });
            it('should call the callback with the proper arguments', function() {
                var callback = jasmine.createSpy('callback'),
                    arr = createArrayLikeFromArray(['1']);
                Array.prototype.filter.call(arr, callback);
                expect(callback).toHaveBeenCalledWith('1', 0, arr);
            });
            it('should not affect elements added to the array after it has begun', function() {
                var arr = createArrayLikeFromArray([1,2,3]),
                    i = 0;
                Array.prototype.filter.call(arr, function(a) {
                    i++;
                    if(i <= 4) {
                        arr[i+2] = a+3;
                    }
                    return true;
                });
                delete arr.length;
                expect(arr).toExactlyMatch([1,2,3,4,5,6]);
                expect(i).toBe(3);
            });
            it('should skip non-set values', function() {
                var passedValues = {};
                testSubject = createArrayLikeFromArray([1,2,3,4]);
                delete testSubject[1];
                Array.prototype.filter.call(testSubject, function(o, i) {
                    passedValues[i] = o;
                    return true;
                });
                delete testSubject.length;
                expect(passedValues).toExactlyMatch(testSubject);
            });
            it('should set the right context when given none', function() {
                var context;
                Array.prototype.filter.call(createArrayLikeFromArray([1]), function() {context = this;}, undefined);
                expect(context).toBe(function() {return this}.call());
            });
            it('should pass the right context to the filter', function() {
                var passedValues = {};
                testSubject = createArrayLikeFromArray([1,2,3,4]);
                delete testSubject[1];
                Array.prototype.filter.call(testSubject, function(o, i) {
                    this[i] = o;
                    return true;
                }, passedValues);
                delete testSubject.length;
                expect(passedValues).toExactlyMatch(testSubject);
            });
            it('should remove only the values for which the callback returns false', function() {
                var result = Array.prototype.filter.call(testSubject, callback);
                expect(result).toExactlyMatch(filteredArray);
            });
            it('should leave the original array untouched', function() {
                var copy = createArrayLikeFromArray(testSubject);
                Array.prototype.filter.call(testSubject, callback);
                expect(testSubject).toExactlyMatch(copy);
            });
        });
    });
    describe('map', function() {
        var callback;
        beforeEach(function() {
            var i = 0;
            callback = function() {
                return i++;
            };
        });
        describe('Array object', function() {
            it('should call callback with the right parameters', function() {
                var callback = jasmine.createSpy('callback'),
                    array = [1];
                array.map(callback);
                expect(callback).toHaveBeenCalledWith(1, 0, array);
            });
            it('should set the context correctly', function() {
                var context = {};
                testSubject.map(function(o,i) {
                    this[i] = o;
                }, context);
                expect(context).toExactlyMatch(testSubject);
            });
            it('should set the right context when given none', function() {
                var context;
                [1].map(function() {context = this;});
                expect(context).toBe(function() {return this}.call());
            });
            it('should not change the array it is called on', function() {
                var copy = testSubject.slice();
                testSubject.map(callback);
                expect(testSubject).toExactlyMatch(copy);
            });
            it('should only run for the number of objects in the array when it started', function() {
                var arr = [1,2,3],
                    i = 0;
                arr.map(function(o) {
                    arr.push(o+3);
                    i++;
                    return o;
                });
                expect(arr).toExactlyMatch([1,2,3,4,5,6]);
                expect(i).toBe(3);
            });
            it('should properly translate the values as according to the callback', function() {
                var result = testSubject.map(callback),
                    expected = [0,0,1,2,3,4,5,6];
                delete expected[1];
                expect(result).toExactlyMatch(expected);
            });
            it('should skip non-existing values', function() {
                var array = [1,2,3,4], 
                    i = 0;
                delete array[2];
                array.map(function() {
                    i++;
                });
                expect(i).toBe(3);
            });
        });
        describe('Array-like', function() {
            beforeEach(function() {
                testSubject = createArrayLikeFromArray(testSubject);
            });
            it('should call callback with the right parameters', function() {
                var callback = jasmine.createSpy('callback'),
                    array = createArrayLikeFromArray([1]);
                Array.prototype.map.call(array, callback);
                expect(callback).toHaveBeenCalledWith(1, 0, array);
            });
            it('should set the context correctly', function() {
                var context = {};
                Array.prototype.map.call(testSubject, function(o,i) {
                    this[i] = o;
                }, context);
                delete testSubject.length;
                expect(context).toExactlyMatch(testSubject);
            });
            it('should set the right context when given none', function() {
                var context;
                Array.prototype.map.call(createArrayLikeFromArray([1]), function() {context = this;});
                expect(context).toBe(function() {return this}.call());
            });
            it('should not change the array it is called on', function() {
                var copy = createArrayLikeFromArray(testSubject);
                Array.prototype.map.call(testSubject, callback);
                expect(testSubject).toExactlyMatch(copy);
            });
            it('should only run for the number of objects in the array when it started', function() {
                var arr = createArrayLikeFromArray([1,2,3]),
                    i = 0;
                Array.prototype.map.call(arr, function(o) {
                    Array.prototype.push.call(arr, o+3);
                    i++;
                    return o;
                });
                delete arr.length;
                expect(arr).toExactlyMatch([1,2,3,4,5,6]);
                expect(i).toBe(3);
            });
            it('should properly translate the values as according to the callback', function() {
                var result = Array.prototype.map.call(testSubject, callback),
                    expected = [0,0,1,2,3,4,5,6];
                delete expected[1];
                expect(result).toExactlyMatch(expected);
            });
            it('should skip non-existing values', function() {
                var array = createArrayLikeFromArray([1,2,3,4]), 
                    i = 0;
                delete array[2];
                Array.prototype.map.call(array, function() {
                    i++;
                });
                expect(i).toBe(3);
            });
        });
    });
    
    describe('reduce', function() {
        beforeEach(function() {
            testSubject = [1,2,3];
        });
        
        describe('Array', function() {
            it('should pass the correct arguments to the callback', function() {
                var spy = jasmine.createSpy().andReturn(0);
                testSubject.reduce(spy);
                expect(spy.calls[0].args).toExactlyMatch([1, 2, 1, testSubject]);
            });
            it('should start with the right initialValue', function() {
                var spy = jasmine.createSpy().andReturn(0);
                testSubject.reduce(spy, 0);
                expect(spy.calls[0].args).toExactlyMatch([0, 1, 0, testSubject]);
            });
            it('should not affect elements added to the array after it has begun', function() {
                var arr = [1,2,3],
                    i = 0;
                arr.reduce(function(a, b) {
                    i++;
                    if(i <= 4) {
                        arr.push(a+3);
                    };
                    return b;
                });
                expect(arr).toEqual([1,2,3,4,5]);
                expect(i).toBe(2);
            });
            it('should work as expected for empty arrays', function() {
                var spy = jasmine.createSpy();
                expect(function() {
                    [].reduce(spy);
                }).toThrow();
                expect(spy).not.toHaveBeenCalled();
            });
            it('should throw correctly if no callback is given', function() {
                expect(function() {
                    testSubject.reduce();
                }).toThrow();
            });
            it('should return the expected result', function() {
                expect(testSubject.reduce(function(a,b) {
                    return (a||'').toString()+(b||'').toString();
                })).toEqual(testSubject.join(''));
            });
            it('should not directly affect the passed array', function() {
                var copy = testSubject.slice();
                testSubject.reduce(function(a,b) {
                    return a+b;
                });
                expect(testSubject).toEqual(copy);
            });
            it('should skip non-set values', function() {
                delete testSubject[1];
                var visited = {};
                testSubject.reduce(function(a,b) {
                    if(a)
                        visited[a] = true;
                    if(b)
                        visited[b] = true;
                    return 0;
                });
                
                expect(visited).toEqual({ '1': true, '3': true });
            });
            it('should have the right length', function() {
                expect(testSubject.reduce.length).toBe(1);
            });
        });
        describe('Array-like objects', function() {
            beforeEach(function() {
                testSubject = createArrayLikeFromArray(testSubject);
                testSubject.reduce = Array.prototype.reduce;
            });
            it('should pass the correct arguments to the callback', function() {
                var spy = jasmine.createSpy().andReturn(0);
                testSubject.reduce(spy);
                expect(spy.calls[0].args).toExactlyMatch([1, 2, 1, testSubject]);
            });
            it('should start with the right initialValue', function() {
                var spy = jasmine.createSpy().andReturn(0);
                testSubject.reduce(spy, 0);
                expect(spy.calls[0].args).toExactlyMatch([0, 1, 0, testSubject]);
            });
            it('should not affect elements added to the array after it has begun', function() {
                var arr = createArrayLikeFromArray([1,2,3]),
                    i = 0;
                Array.prototype.reduce.call(arr, function(a, b) {
                    i++;
                    if(i <= 4) {
                        arr[i+2] = a+3;
                    };
                    return b;
                });
                expect(arr).toEqual({
                    0: 1,
                    1: 2,
                    2: 3,
                    3: 4,
                    4: 5,
                    length: 3
                });
                expect(i).toBe(2);
            });
            it('should work as expected for empty arrays', function() {
                var spy = jasmine.createSpy();
                expect(function() {
                    Array.prototype.reduce.call({length: 0}, spy);
                }).toThrow();
                expect(spy).not.toHaveBeenCalled();
            });
            it('should throw correctly if no callback is given', function() {
                expect(function() {
                    testSubject.reduce();
                }).toThrow();
            });
            it('should return the expected result', function() {
                expect(testSubject.reduce(function(a,b) {
                    return (a||'').toString()+(b||'').toString();
                })).toEqual('123');
            });
            it('should not directly affect the passed array', function() {
                var copy = createArrayLikeFromArray(testSubject);
                testSubject.reduce(function(a,b) {
                    return a+b;
                });
                delete(testSubject.reduce);
                expect(testSubject).toEqual(copy);
            });
            it('should skip non-set values', function() {
                delete testSubject[1];
                var visited = {};
                testSubject.reduce(function(a,b) {
                    if(a)
                        visited[a] = true;
                    if(b)
                        visited[b] = true;
                    return 0;
                });
                
                expect(visited).toEqual({ '1': true, '3': true });
            });
            it('should have the right length', function() {
                expect(testSubject.reduce.length).toBe(1);
            });
        });
    });
    describe('reduceRight', function() {
        beforeEach(function() {
            testSubject = [1,2,3];
        });
        
        describe('Array', function() {
            it('should pass the correct arguments to the callback', function() {
                var spy = jasmine.createSpy().andReturn(0);
                testSubject.reduceRight(spy);
                expect(spy.calls[0].args).toExactlyMatch([3, 2, 1, testSubject]);
            });
            it('should start with the right initialValue', function() {
                var spy = jasmine.createSpy().andReturn(0);
                testSubject.reduceRight(spy, 0);
                expect(spy.calls[0].args).toExactlyMatch([0, 3, 2, testSubject]);
            });
            it('should not affect elements added to the array after it has begun', function() {
                var arr = [1,2,3],
                    i = 0;
                arr.reduceRight(function(a, b) {
                    i++;
                    if(i <= 4) {
                        arr.push(a+3);
                    };
                    return b;
                });
                expect(arr).toEqual([1,2,3,6,5]);
                expect(i).toBe(2);
            });
            it('should work as expected for empty arrays', function() {
                var spy = jasmine.createSpy();
                expect(function() {
                    [].reduceRight(spy);
                }).toThrow();
                expect(spy).not.toHaveBeenCalled();
            });
            it('should throw correctly if no callback is given', function() {
                expect(function() {
                    testSubject.reduceRight();
                }).toThrow();
            });
            it('should return the expected result', function() {
                expect(testSubject.reduceRight(function(a,b) {
                    return (a||'').toString()+(b||'').toString();
                })).toEqual('321');
            });
            it('should not directly affect the passed array', function() {
                var copy = testSubject.slice();
                testSubject.reduceRight(function(a,b) {
                    return a+b;
                });
                expect(testSubject).toEqual(copy);
            });
            it('should skip non-set values', function() {
                delete testSubject[1];
                var visited = {};
                testSubject.reduceRight(function(a,b) {
                    if(a)
                        visited[a] = true;
                    if(b)
                        visited[b] = true;
                    return 0;
                });
                
                expect(visited).toEqual({ '1': true, '3': true });
            });
            it('should have the right length', function() {
                expect(testSubject.reduceRight.length).toBe(1);
            });
        });
        describe('Array-like objects', function() {
            beforeEach(function() {
                testSubject = createArrayLikeFromArray(testSubject);
                testSubject.reduceRight = Array.prototype.reduceRight;
            });
            it('should pass the correct arguments to the callback', function() {
                var spy = jasmine.createSpy().andReturn(0);
                testSubject.reduceRight(spy);
                expect(spy.calls[0].args).toExactlyMatch([3, 2, 1, testSubject]);
            });
            it('should start with the right initialValue', function() {
                var spy = jasmine.createSpy().andReturn(0);
                testSubject.reduceRight(spy, 0);
                expect(spy.calls[0].args).toExactlyMatch([0, 3, 2, testSubject]);
            });
            it('should not affect elements added to the array after it has begun', function() {
                var arr = createArrayLikeFromArray([1,2,3]),
                    i = 0;
                Array.prototype.reduceRight.call(arr, function(a, b) {
                    i++;
                    if(i <= 4) {
                        arr[i+2] = a+3;
                    };
                    return b;
                });
                expect(arr).toEqual({
                    0: 1,
                    1: 2,
                    2: 3,
                    3: 6,
                    4: 5,
                    length: 3 // does not get updated on property assignment
                });
                expect(i).toBe(2);
            });
            it('should work as expected for empty arrays', function() {
                var spy = jasmine.createSpy();
                expect(function() {
                    Array.prototype.reduceRight.call({length:0}, spy);
                }).toThrow();
                expect(spy).not.toHaveBeenCalled();
            });
            it('should throw correctly if no callback is given', function() {
                expect(function() {
                    testSubject.reduceRight();
                }).toThrow();
            });
            it('should return the expected result', function() {
                expect(testSubject.reduceRight(function(a,b) {
                    return (a||'').toString()+(b||'').toString();
                })).toEqual('321');
            });
            it('should not directly affect the passed array', function() {
                var copy = createArrayLikeFromArray(testSubject);
                testSubject.reduceRight(function(a,b) {
                    return a+b;
                });
                delete(testSubject.reduceRight);
                expect(testSubject).toEqual(copy);
            });
            it('should skip non-set values', function() {
                delete testSubject[1];
                var visited = {};
                testSubject.reduceRight(function(a,b) {
                    if(a)
                        visited[a] = true;
                    if(b)
                        visited[b] = true;
                    return 0;
                });
                
                expect(visited).toEqual({ '1': true, '3': true });
            });
            it('should have the right length', function() {
                expect(testSubject.reduceRight.length).toBe(1);
            });
        });
    });

    describe('isArray', function () {
        it('should work for Array', function () {
            var ret = Array.isArray([]);

            expect(ret).toBe(true);
        });

        it('should fail for other objects', function () {
            var objects = [
                "someString",
                true,
                false,
                42,
                0,
                {},
                Object.create(null),
                /foo/,
                arguments,
                document.getElementsByTagName("div")
            ];

            objects.forEach(function (v) {
                expect(Array.isArray(v)).toBe(false);
            });
        });
    });

    describe('unshift', function () {
        it('should return length', function () {
            expect([].unshift(0)).toEqual(1);
        });
    });

    describe('splice', function () {
        var b = ["b"],
            a = [1, "a", b],
            test;
        beforeEach(function() {
            test = a.slice(0);
        });
        
        it('basic implementation test 1', function () {
            expect(test.splice(0)).toEqual(a);
        });
        it('basic implementation test 2', function () {
            test.splice(0, 2);
            expect(test).toEqual([b]);
        });            
                 
        
        it('should do nothing if method called with no arguments', function () {
            expect(test.splice()).toEqual([]);
            expect(test).toEqual(a);
        });
        //TODO:: Is this realy TRUE behavior?
        it('should set first argument to 0 if first argument is set but undefined', function () {
            var test2 = test.slice(0);
            expect(test.splice(void 0, 2)).toEqual(test2.splice(0, 2));
            expect(test).toEqual(test2);
        });

        it('should deleted and return all items after "start" when second argument is undefined', function () {
            expect(test.splice(0)).toEqual(a);
            expect(test).toEqual([]);
        });
        it('should deleted and return all items after "start" when second argument is undefined', function () {
            expect(test.splice(2)).toEqual([b]);
            expect(test).toEqual([1, "a"]);
        });
        it('runshould have the right length', function () {
            expect(test.splice.length).toBe(2);
        }); 
    });

    
});
