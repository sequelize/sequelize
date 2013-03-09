/**
 * css tests
 *
 * @author Craig Campbell
 */
RainbowTester.startTest('css');

RainbowTester.run(
    'comment',

    '/* comment */',

    '<span class="comment">/* comment */</span>'
);

RainbowTester.run(
    'multi-line comment',

    '/**\n' +
    ' * comment\n' +
    ' */',

    '<span class="comment">/**\n' +
    ' * comment\n' +
    ' */</span>'
);

RainbowTester.run(
    'pixels',

    'margin:10px 20px 5px 30px;',

    '<span class="support css-property">margin</span>:<span class="constant numeric">10</span><span class="keyword unit">px</span> <span class="constant numeric">20</span><span class="keyword unit">px</span> <span class="constant numeric">5</span><span class="keyword unit">px</span> <span class="constant numeric">30</span><span class="keyword unit">px</span>;'
);

RainbowTester.run(
    'cm',

    'margin: 1cm 2cm 1.3cm 4cm;',

    '<span class="support css-property">margin</span>: <span class="constant numeric">1</span><span class="keyword unit">cm</span> <span class="constant numeric">2</span><span class="keyword unit">cm</span> <span class="constant numeric">1</span>.<span class="constant numeric">3</span><span class="keyword unit">cm</span> <span class="constant numeric">4</span><span class="keyword unit">cm</span>;'
);

RainbowTester.run(
    'percentage',

    'width: 100%\n' +
    'height: 100%',

    '<span class="support css-property">width</span>: <span class="constant numeric">100</span><span class="keyword unit">%</span>\n' +
    '<span class="support css-property">height</span>: <span class="constant numeric">100</span><span class="keyword unit">%</span>'
);

RainbowTester.run(
    'string single quote',

    '\'test string\'',

    '<span class="string">\'test string\'</span>'
);

RainbowTester.run(
    'string double quote',

    '"test string"',

    '<span class="string">"test string"</span>'
);

RainbowTester.run(
    'transition - vendor prefix',

    'code span {\n' +
        '   -moz-transition: color .8s ease-in;\n' +
        '   -o-transition: color .8s ease-in;\n' +
        '   -webkit-transition: color .8s ease-in;\n' +
        '   transition: color .8s ease-in;\n' +
    '}',

    '<span class="entity name tag">code</span> <span class="entity name tag">span</span> {\n' +
    '   <span class="support css-property"><span class="support vendor-prefix">-moz-</span>transition</span>: <span class="support css-value">color</span> .<span class="constant numeric">8</span><span class="keyword unit">s</span> ease-in;\n' +
    '   <span class="support css-property"><span class="support vendor-prefix">-o-</span>transition</span>: <span class="support css-value">color</span> .<span class="constant numeric">8</span><span class="keyword unit">s</span> ease-in;\n' +
    '   <span class="support css-property"><span class="support vendor-prefix">-webkit-</span>transition</span>: <span class="support css-value">color</span> .<span class="constant numeric">8</span><span class="keyword unit">s</span> ease-in;\n' +
    '   <span class="support css-property">transition</span>: <span class="support css-value">color</span> .<span class="constant numeric">8</span><span class="keyword unit">s</span> ease-in;\n' +
    '}'
);

RainbowTester.run(
    'tag',

    'p {',

    '<span class="entity name tag">p</span> {'
);

RainbowTester.run(
    'class',

    'p.intro {',

    '<span class="entity name tag">p</span><span class="entity name class">.intro</span> {'
);

RainbowTester.run(
    'id',

    'p#intro {',

    '<span class="entity name tag">p</span><span class="entity name id">#intro</span> {'
);

RainbowTester.run(
    'direct descendant',

    'p > span {',

    '<span class="entity name tag">p</span> <span class="direct-descendant">&gt;</span> <span class="entity name tag">span</span> {'
);

RainbowTester.run(
    'scss',

    'article {\n' +
    '   &amp;.cool {\n' +
    '       p {\n' +
    '           margin-top: 20px;\n' +
    '       }\n' +
    '   }\n' +
    '}',

    '<span class="entity name tag">article</span> {\n' +
    '   <span class="entity name sass">&amp;</span><span class="entity name class">.cool</span> {\n' +
    '       <span class="entity name tag">p</span> {\n' +
    '           <span class="support css-property">margin-top</span>: <span class="constant numeric">20</span><span class="keyword unit">px</span>;\n' +
    '       }\n' +
    '   }\n' +
    '}'
);

RainbowTester.run(
    'style tag',

    '<style></style>',

    '<span class="support tag style">&lt;</span><span class="entity tag style">style</span><span class="support tag style">&gt;</span><span class="support tag style">&lt;/</span><span class="entity tag style">style</span><span class="support tag style">&gt;</span>'
);

RainbowTester.run(
    'style tag with type',

    '<style type="text/css"></style>',

    '<span class="support tag style">&lt;</span><span class="entity tag style">style</span> <span class="entity tag style">type</span>=<span class="string">"text/css"</span><span class="support tag style">&gt;</span><span class="support tag style">&lt;/</span><span class="entity tag style">style</span><span class="support tag style">&gt;</span>'
);

RainbowTester.run(
    'one line',

    'p { color: #fff; margin-top: 10px; }',

    '<span class="entity name tag">p</span> { <span class="support css-property">color</span>: <span class="constant hex-color">#fff</span>; <span class="support css-property">margin-top</span>: <span class="constant numeric">10</span><span class="keyword unit">px</span>; }'
);

RainbowTester.endTest('css');
