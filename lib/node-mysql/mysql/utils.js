var scope = function(target, func) {
    return function(){ return func.apply(target, arguments); }
}
exports.scope = scope;
