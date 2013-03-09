/**
 * CSS patterns
 *
 * @author Craig Campbell
 * @version 1.0.6
 */
Rainbow.extend('css', [
    {
        'name': 'comment',
        'pattern': /\/\*[\s\S]*?\*\//gm
    },
    {
        'name': 'constant.hex-color',
        'pattern': /#([a-f0-9]{3}|[a-f0-9]{6})(?=;|\s)/gi
    },
    {
        'matches': {
            1: 'constant.numeric',
            2: 'keyword.unit'
        },
        'pattern': /(\d+)(px|cm|s|%)?/g
    },
    {
        'name': 'string',
        'pattern': /('|")(.*?)\1/g
    },
    {
        'name': 'support.css-property',
        'matches': {
            1: 'support.vendor-prefix'
        },
        'pattern': /(-o-|-moz-|-webkit-|-ms-)?[\w-]+(?=\s?:)(?!.*\{)/g
    },
    {
        'matches': {
            1: [
                {
                    'name': 'entity.name.sass',
                    'pattern': /&amp;/g
                },
                {
                    'name': 'direct-descendant',
                    'pattern': /&gt;/g
                },
                {
                    'name': 'entity.name.class',
                    'pattern': /\.[\w\-_]+/g
                },
                {
                    'name': 'entity.name.id',
                    'pattern': /\#[\w\-_]+/g
                },
                {
                    'name': 'entity.name.pseudo',
                    'pattern': /:[\w\-_]+/g
                },
                {
                    'name': 'entity.name.tag',
                    'pattern': /\w+/g
                }
            ]
        },
        'pattern': /([\w\ ,:\.\#\&\;\-_]+)(?=.*\{)/g
    },
    {
        'matches': {
            2: 'support.vendor-prefix',
            3: 'support.css-value'
        },
        'pattern': /(:|,)\s?(-o-|-moz-|-webkit-|-ms-)?([a-zA-Z-]*)(?=\b)(?!.*\{)/g
    },
    {
        'matches': {
            1: 'support.tag.style',
            2: [
                {
                    'name': 'string',
                    'pattern': /('|")(.*?)(\1)/g
                },
                {
                    'name': 'entity.tag.style',
                    'pattern': /(\w+)/g
                }
            ],
            3: 'support.tag.style'
        },
        'pattern': /(&lt;\/?)(style.*?)(&gt;)/g
    }
], true);
