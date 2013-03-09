# Rainbow

Rainbow is a code syntax highlighting library written in Javascript.

It was designed to be lightweight (1.4kb), easy to use, and extendable.

It is completely themable via CSS.

## Quick Start

1. Include some markup for code you want to be highlighted:

    ```html
    <pre><code data-language="python">def openFile(path):
        file = open(path, "r")
        content = file.read()
        file.close()
        return content</code></pre>
    ```

2. Include a CSS theme file in the ``<head>``:

    ```html
    <link href="/assets/css/theme.css" rel="stylesheet" type="text/css">
    ```

3. Include rainbow.js and whatever languages you want before the closing ``</body>``:
    
    ```html
    <script src="/assets/js/rainbow.min.js"></script>
    <script src="/assets/js/language/generic.js"></script>
    <script src="/assets/js/language/python.js"></script>
    ```

## Extending Rainbow
If you have a language specific pattern that you want highlighted, but it does not exist in the language syntax rules you can add a rule on your page.

Let's say for example you want to reference PHP's apc functions.
You can include the php language then in the markup on your page add:

```html
<script>
    Rainbow.extend('php', [
        {
            'matches': {
                1: 'support.function'
            },
            'pattern': /\b(apc_(store|fetch|add|inc))(?=\()/g
        }  
    ]);
</script>
```

## More Info

You can check out additional documentation and build custom packages at [rainbowco.de](http://rainbowco.de).