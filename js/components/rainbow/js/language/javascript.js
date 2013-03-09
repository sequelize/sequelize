/**
 * Javascript patterns
 *
 * @author Craig Campbell
 * @version 1.0.6
 */
Rainbow.extend('javascript', [

    /**
     * matches $. or $(
     */
    {
        'name': 'selector',
        'pattern': /(\s|^)\$(?=\.|\()/g
    },
    {
        'name': 'support',
        'pattern': /\b(window|document)\b/g
    },
    {
        'matches': {
            1: 'support.property'
        },
        'pattern': /\.(length|node(Name|Value))\b/g
    },
    {
        'matches': {
            1: 'support.function'
        },
        'pattern': /(setTimeout|setInterval)(?=\()/g

    },
    {
        'matches': {
            1: 'support.method'
        },
        'pattern': /\.(getAttribute|push|getElementById|getElementsByClassName|log|setTimeout|setInterval)(?=\()/g
    },
    {
        'matches': {
            1: 'support.tag.script',
            2: [
                {
                    'name': 'string',
                    'pattern': /('|")(.*?)(\1)/g
                },
                {
                    'name': 'entity.tag.script',
                    'pattern': /(\w+)/g
                }
            ],
            3: 'support.tag.script'
        },
        'pattern': /(&lt;\/?)(script.*?)(&gt;)/g
    },

    /**
     * matches any escaped characters inside of a js regex pattern
     *
     * @see https://github.com/ccampbell/rainbow/issues/22
     *
     * this was causing single line comments to fail so it now makes sure
     * the opening / is not directly followed by a *
     *
     * @todo check that there is valid regex in match group 1
     */
    {
        'name': 'string.regexp',
        'matches': {
            1: 'string.regexp.open',
            2: {
                'name': 'constant.regexp.escape',
                'pattern': /\\(.){1}/g
            },
            3: 'string.regexp.close',
            4: 'string.regexp.modifier'
        },
        'pattern': /(\/)(?!\*)(.+)(\/)([igm]{0,3})/g
    },

    /**
     * matches runtime function declarations
     */
    {
        'matches': {
            1: 'storage',
            3: 'entity.function'
        },
        'pattern': /(var)?(\s|^)(.*)(?=\s?=\s?function\()/g
    },

    /**
     * matches any function call in the style functionName: function()
     */
    {
        'name': 'entity.function',
        'pattern': /(\w+)(?=:\s{0,}function)/g
    }
]);
