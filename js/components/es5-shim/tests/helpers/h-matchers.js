beforeEach(function() {
    this.addMatchers({
        toExactlyMatch: function(expected) {
            var a1, a2,
                l, i,
                key,
                actual = this.actual;
            
            var getKeys = function(o) {
                var a = [];
                for(key in o) {
                    if(o.hasOwnProperty(key)) {
                        a.push(key);
                    }
                }
                return a;
            }
            a1 = getKeys(actual);
            a2 = getKeys(expected);
            
            l = a1.length;
            if(l !== a2.length) {
                return false;
            }
            for(i = 0; i < l; i++) {
                key = a1[i];
                expect(key).toEqual(a2[i]);
                expect(actual[key]).toEqual(expected[key]);
            }
            
            return true;
        }
    })
});
