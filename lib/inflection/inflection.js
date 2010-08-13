/**
 * A port of the Rails/ActiveSupport Inflector class
 * http://api.rubyonrails.org/classes/ActiveSupport/Inflector.html
 */
 
var inflections = exports.inflections = {
    plurals: [],
    singulars: [],
    uncountables: [],
    humans: []
};

var PLURALS = inflections.plurals,
    SINGULARS = inflections.singulars,
    UNCOUNTABLES = inflections.uncountables,
    HUMANS = inflections.humans;
    
/**
 * Specifies a new pluralization rule and its replacement. The rule can either 
 * be a string or a regular expression. The replacement should always be a 
 * string that may include references to the matched data from the rule.
 */
var plural = function (rule, replacement) {
    //inflections.uncountables.delete(rule) if rule.is_a?(String)
    //inflections.uncountables.delete(replacement)
    inflections.plurals.unshift([rule, replacement]);
}

/**
 * Specifies a new singularization rule and its replacement. The rule can either 
 * be a string or a regular expression. The replacement should always be a 
 * string that may include references to the matched data from the rule.
 */
var singular = function (rule, replacement) {
    //inflections.uncountables.delete(rule) if rule.is_a?(String)
    //inflections.uncountables.delete(replacement)
    inflections.singulars.unshift([rule, replacement]);
}

/**
 * Add uncountable words that shouldn't be attempted inflected.
 */
var uncountable = function (word) {
    inflections.uncountables.unshift(word);
}

/**
 * Specifies a new irregular that applies to both pluralization and 
 * singularization at the same time. This can only be used for strings, not 
 * regular expressions. You simply pass the irregular in singular and plural 
 * form.
 *
 * Examples:
 *  irregular("octopus", "octopi");
 *  irregular("person", "people");
 */
var irregular = function (s, p) {
    //inflections.uncountables.delete(singular);
    //inflections.uncountables.delete(plural);
    if (s.substr(0, 1).toUpperCase() == p.substr(0, 1).toUpperCase()) {
        plural(new RegExp("(" + s.substr(0, 1) + ")" + s.substr(1) + "$", "i"), '$1' + p.substr(1));
        plural(new RegExp("(" + p.substr(0, 1) + ")" + p.substr(1) + "$", "i"), '$1' + p.substr(1));
        singular(new RegExp("(" + p.substr(0, 1) + ")" + p.substr(1) + "$", "i"), '$1' + s.substr(1));
    } else {
        plural(new RegExp(s.substr(0, 1).toUpperCase() + s.substr(1) + "$"), p.substr(0, 1).toUpperCase() + p.substr(1));
        plural(new RegExp(s.substr(0, 1).toLowerCase() + s.substr(1) + "$"), p.substr(0, 1).toLowerCase() + p.substr(1));
        plural(new RegExp(p.substr(0, 1).toUpperCase() + p.substr(1) + "$"), p.substr(0, 1).toUpperCase() + p.substr(1));
        plural(new RegExp(p.substr(0, 1).toLowerCase() + p.substr(1) + "$"), p.substr(0, 1).toLowerCase() + p.substr(1));
        singular(new RegExp(p.substr(0, 1).toUpperCase() + p.substr(1) + "$"), s.substr(0, 1).toUpperCase() + s.substr(1));
        singular(new RegExp(p.substr(0, 1).toLowerCase() + p.substr(1) + "$"), s.substr(0, 1).toLowerCase() + s.substr(1));
    }
}

/**
 * Specifies a humanized form of a string by a regular expression rule or by a 
 * string mapping. When using a regular expression based replacement, the normal 
 * humanize formatting is called after the replacement.
 */
var human = function (rule, replacement) {
    //inflections.uncountables.delete(rule) if rule.is_a?(String)
    //inflections.uncountables.delete(replacement)
    inflections.humans.push([rule, replacement]);
}

plural(/$/, "s");
plural(/s$/i, "s");
plural(/(ax|test)is$/i, "$1es");
plural(/(octop|vir)us$/i, "$1i");
plural(/(alias|status)$/i, "$1es");
plural(/(bu)s$/i, "$1ses");
plural(/(buffal|tomat)o$/i, "$1oes");
plural(/([ti])um$/i, "$1a");
plural(/sis$/i, "ses");
plural(/(?:([^f])fe|([lr])f)$/i, "$1$2ves");
plural(/(hive)$/i, "$1s");
plural(/([^aeiouy]|qu)y$/i, "$1ies");
plural(/(x|ch|ss|sh)$/i, "$1es");
plural(/(matr|vert|ind)(?:ix|ex)$/i, "$1ices");
plural(/([m|l])ouse$/i, "$1ice");
plural(/^(ox)$/i, "$1en");
plural(/(quiz)$/i, "$1zes");

singular(/s$/i, "")
singular(/(n)ews$/i, "$1ews")
singular(/([ti])a$/i, "$1um")
singular(/((a)naly|(b)a|(d)iagno|(p)arenthe|(p)rogno|(s)ynop|(t)he)ses$/i, "$1$2sis")
singular(/(^analy)ses$/i, "$1sis")
singular(/([^f])ves$/i, "$1fe")
singular(/(hive)s$/i, "$1")
singular(/(tive)s$/i, "$1")
singular(/([lr])ves$/i, "$1f")
singular(/([^aeiouy]|qu)ies$/i, "$1y")
singular(/(s)eries$/i, "$1eries")
singular(/(m)ovies$/i, "$1ovie")
singular(/(x|ch|ss|sh)es$/i, "$1")
singular(/([m|l])ice$/i, "$1ouse")
singular(/(bus)es$/i, "$1")
singular(/(o)es$/i, "$1")
singular(/(shoe)s$/i, "$1")
singular(/(cris|ax|test)es$/i, "$1is")
singular(/(octop|vir)i$/i, "$1us")
singular(/(alias|status)es$/i, "$1")
singular(/^(ox)en/i, "$1")
singular(/(vert|ind)ices$/i, "$1ex")
singular(/(matr)ices$/i, "$1ix")
singular(/(quiz)zes$/i, "$1")
singular(/(database)s$/i, "$1")

irregular("person", "people");
irregular("man", "men");
irregular("child", "children");
irregular("sex", "sexes");
irregular("move", "moves");
irregular("cow", "kine");

uncountable("equipment");
uncountable("information");
uncountable("rice");
uncountable("money");
uncountable("species");
uncountable("series");
uncountable("fish");
uncountable("sheep");
uncountable("jeans");

/**
 * Returns the plural form of the word in the string.
 */
exports.pluralize = function (word) {
    var wlc = word.toLowerCase();
    
    for (var i = 0; i < UNCOUNTABLES.length; i++) {
        var uncountable = UNCOUNTABLES[i];
        if (wlc == uncountable) {
            return word;
        }
    }
    
    for (var i = 0; i < PLURALS.length; i++) {
        var rule = PLURALS[i][0],
            replacement = PLURALS[i][1];        
        if (rule.test(word)) {
            return word.replace(rule, replacement);
        }
    }    
}

/**
 * Returns the singular form of the word in the string.
 */
exports.singularize = function (word) {
    var wlc = word.toLowerCase();
    
    for (var i = 0; i < UNCOUNTABLES.length; i++) {
        var uncountable = UNCOUNTABLES[i];
        if (wlc == uncountable) {
            return word;
        }
    }
    
    for (var i = 0; i < SINGULARS.length; i++) {
        var rule = SINGULARS[i][0],
            replacement = SINGULARS[i][1];        
        if (rule.test(word)) {
            return word.replace(rule, replacement);
        }
    }    
}

/**
 * Capitalizes the first word and turns underscores into spaces and strips a
 * trailing "Key", if any. Like +titleize+, this is meant for creating pretty 
 * output.
 *
 * Examples:
 *   "employeeSalary" => "employee salary"
 *   "authorKey"       => "author"
 */
exports.humanize = function (word) {
    for (var i = 0; i < HUMANS.length; i++) {
        var rule = HUMANS[i][0],
            replacement = HUMANS[i][1];        
        if (rule.test(word)) {
            word = word.replace(rule, replacement);
        }
    }    

    return exports.split(word, " ").toLowerCase();
}

/**
 * Split a camel case word in its terms.
 */
exports.split = function (word, delim) {
    delim = delim || " ";
    var replacement = "$1" + delim + "$2";
    return word.
        replace(/([A-Z]+)([A-Z][a-z])/g, replacement).
        replace(/([a-z\d])([A-Z])/g, replacement);
}

/**
 * Converts a CamelCase word to underscore format.
 */
exports.underscore = function (word) {
    return exports.split(word, "_").toLowerCase();
}

/**
 * Converts a CamelCase word to dash (lisp style) format.
 */
exports.dash = exports.dasherize = function (word) {
    return exports.split(word, "-").toLowerCase();
}
