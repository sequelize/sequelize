/**
 * javascript tests
 *
 * @author Craig Campbell
 */
RainbowTester.startTest('javascript');

RainbowTester.run(
    'selector 1',

    '$.get()',

    '<span class="selector">$</span>.<span class="function call">get</span>()'
);

RainbowTester.run(
    'selector 2',

    ' $(\'.some_class\').show()',

    '<span class="selector"> $</span>(<span class="string">\'.some_class\'</span>).<span class="function call">show</span>()'
);

RainbowTester.run(
    'window',

    'console.log(window.scrollX)',

    'console.<span class="support method">log</span>(<span class="support">window</span>.scrollX)'
);

RainbowTester.run(
    'document',

    'document.getElementById(\'#some_id\')',

    '<span class="support">document</span>.<span class="support method">getElementById</span>(<span class="string">\'#some_id\'</span>)'
);

RainbowTester.run(
    'regex',

    'var pattern = /\\((.*?)\\)/g',

    '<span class="keyword">var</span> pattern <span class="keyword operator">=</span> <span class="string regexp"><span class="string regexp open">/</span><span class="constant regexp escape">\\(</span>(.*?)<span class="constant regexp escape">\\)</span><span class="string regexp close">/</span><span class="string regexp modifier">g</span></span>'
);

RainbowTester.run(
    'regex 2',

    'var pattern = /true/',

    '<span class="keyword">var</span> pattern <span class="keyword operator">=</span> <span class="string regexp"><span class="string regexp open">/</span>true<span class="string regexp close">/</span></span>'
);

RainbowTester.run(
    'string no regex',

    'var test = "http://website.com/could/match/regex/i";',

    '<span class="keyword">var</span> test <span class="keyword operator">=</span> <span class="string">"http://website.com/could/match/regex/i"</span>;'
);

RainbowTester.run(
    'single line comment vs. regex',

    'var Animal = function() { /* some comment */ };',

    '<span class="storage">var</span> <span class="entity function">Animal </span><span class="keyword operator">=</span> <span class="keyword">function</span>() { <span class="comment">/* some comment */</span> };'
);

RainbowTester.run(
    'inline function',

    'var foo = true,\n' +
    '    something = function() {\n' +
    '       // do something\n' +
    '    };',

    '<span class="keyword">var</span> foo <span class="keyword operator">=</span> <span class="constant language">true</span>,\n' +
    '<span class="entity function">    something </span><span class="keyword operator">=</span> <span class="keyword">function</span>() {\n' +
    '       <span class="comment">// do something</span>\n' +
    '    };'
);

RainbowTester.run(
    'inline function beginning of line',

    'something = function() {\n' +
    '   // do something\n' +
    '};',

    '<span class="entity function">something </span><span class="keyword operator">=</span> <span class="keyword">function</span>() {\n' +
    '   <span class="comment">// do something</span>\n' +
    '};'
);

RainbowTester.run(
    'functions in object',

    'window.Rainbow = {\n' +
    '    color: function() {\n' +
    '        // do something\n' +
    '    },\n' +
    '\n' +
    '    other: function() {}\n' +
    '};',

    '<span class="support">window</span>.Rainbow <span class="keyword operator">=</span> {\n' +
    '    <span class="entity function">color</span>: <span class="keyword">function</span>() {\n' +
    '        <span class="comment">// do something</span>\n' +
    '    },\n' +
    '\n' +
    '    <span class="entity function">other</span>: <span class="keyword">function</span>() {}\n' +
    '};'
);

RainbowTester.endTest('javascript');
