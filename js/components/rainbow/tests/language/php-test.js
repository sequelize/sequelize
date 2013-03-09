/**
 * php tests
 *
 * @author Craig Campbell
 */
RainbowTester.startTest('php');

RainbowTester.run(
    'echo',

    'echo \'hello world\';',

    '<span class="support">echo</span> <span class="string">\'hello world\'</span>;'
);

RainbowTester.run(
    'variable',

    '$foo = true;',

    '<span class="variable dollar-sign">$</span><span class="variable">foo</span> <span class="keyword operator">=</span> <span class="constant language">true</span>;'
);

RainbowTester.run(
    'string concatenation',

    "$foo = 'test' . 'string' . 'concatenation';",

    '<span class="variable dollar-sign">$</span><span class="variable">foo</span> <span class="keyword operator">=</span> <span class="string">\'test\'</span> <span class="keyword dot">.</span> <span class="string">\'string\'</span> <span class="keyword dot">.</span> <span class="string">\'concatenation\'</span>;'
);

RainbowTester.run(
    'include 1',

    "include 'App.php';",

    '<span class="keyword">include</span> <span class="string">\'App.php\'</span>;'
);

RainbowTester.run(
    'include 2',

    "include_once('App.php');",

    '<span class="keyword">include_once</span>(<span class="string">\'App.php\'</span>);'
);

RainbowTester.run(
    'instanceof',

    "$is_array_object = $collection instanceof ArrayObject;",

    '<span class="variable dollar-sign">$</span><span class="variable">is_array_object</span> <span class="keyword operator">=</span> <span class="variable dollar-sign">$</span><span class="variable">collection</span> <span class="keyword">instanceof</span> <span class="support class">ArrayObject</span>;'
);

RainbowTester.run(
    'instanceof namespace class',

    "$is_user = $object instanceof App\\User;",

    '<span class="variable dollar-sign">$</span><span class="variable">is_user</span> <span class="keyword operator">=</span> <span class="variable dollar-sign">$</span><span class="variable">object</span> <span class="keyword">instanceof</span> <span class="support class">App</span>\\<span class="support class">User</span>;'
);

RainbowTester.run(
    'array stuff',

    '$turtles = array(\n' +
    '   \'leonardo\',\n' +
    '   \'michaelangelo\',\n' +
    '   \'donatello\',\n' +
    '   \'raphael\'\n' +
    ');\n' +
    '\n' +
    '$exists = array_key_exists(0, $turtles);',

    '<span class="variable dollar-sign">$</span><span class="variable">turtles</span> <span class="keyword operator">=</span> <span class="support function">array</span>(\n' +
    '   <span class="string">\'leonardo\'</span>,\n' +
    '   <span class="string">\'michaelangelo\'</span>,\n' +
    '   <span class="string">\'donatello\'</span>,\n' +
    '   <span class="string">\'raphael\'</span>\n' +
    ');\n' +
    '\n' +
    '<span class="variable dollar-sign">$</span><span class="variable">exists</span> <span class="keyword operator">=</span> <span class="support function">array_key_exists</span>(<span class="constant numeric">0</span>, <span class="variable dollar-sign">$</span><span class="variable">turtles</span>);'
);

RainbowTester.run(
    'php tag',

    '&lt;?php echo $foo; ?&gt;',

    '<span class="variable language php-tag">&lt;?php</span> <span class="support">echo</span> <span class="variable dollar-sign">$</span><span class="variable">foo</span>; <span class="variable language php-tag">?&gt;</span>'
);

RainbowTester.run(
    'php short tag',

    '&lt;?= $foo; ?&gt;',

    '<span class="variable language php-tag">&lt;?</span><span class="keyword operator">=</span> <span class="variable dollar-sign">$</span><span class="variable">foo</span>; <span class="variable language php-tag">?&gt;</span>'
);

RainbowTester.run(
    'namespace declaration',

    'namespace Sonic\\Database;',

    '<span class="keyword namespace">namespace</span> <span class="support namespace">Sonic</span>\\<span class="support namespace">Database</span>;'
);

RainbowTester.run(
    'class declaration',

    'class MyClass {}',

    '<span class="storage class">class</span> <span class="entity name class">MyClass</span> {}'
);

RainbowTester.run(
    'abstract class declaration',

    'abstract class MyClass {}',

    '<span class="storage modifier">abstract</span> <span class="storage class">class</span> <span class="entity name class">MyClass</span> {}'
);

RainbowTester.run(
    'final class declaration',

    'final class TestClass\n' +
    '{\n' +
    '}',

    '<span class="storage modifier">final</span> <span class="storage class">class</span> <span class="entity name class">TestClass</span>\n' +
    '{\n' +
    '}'
);

RainbowTester.run(
    'child class declaration',

    'class Collection extends ArrayObject {}',

    '<span class="storage class">class</span> <span class="entity name class">Collection</span><span class="storage modifier extends"> extends </span><span class="entity other inherited-class">ArrayObject</span> {}'
);


RainbowTester.run(
    'final child class declaration',

    'final class TestClass extends \\Some\\Other\\Class {}',

    '<span class="storage modifier">final</span> <span class="storage class">class</span> <span class="entity name class">TestClass</span><span class="storage modifier extends"> extends </span><span class="entity other inherited-class">\\Some\\Other\\Class</span> {}'
);

RainbowTester.run(
    'test static',

    'self::_doSomething();\n' +
    'static::_doSomethingElse();',

    '<span class="keyword static">self::</span><span class="function call">_doSomething</span>();\n' +
    '<span class="keyword static">static::</span><span class="function call">_doSomethingElse</span>();'
);

RainbowTester.run(
    'test magic function',

    'function __autoload($class)\n' +
    '{\n' +
    '   // do whatever\n' +
    '}',

    '<span class="storage function">function</span> <span class="support magic">__autoload</span>(<span class="variable dollar-sign">$</span><span class="variable">class</span>)\n' +
    '{\n' +
    '   <span class="comment">// do whatever</span>\n' +
    '}'
);

RainbowTester.run(
    'test magic method',

    'class SomeThing\n' +
    '{\n' +
    '   protected $_foo;\n' +
    '\n' +
    '   public function __construct($foo)\n' +
    '   {\n' +
    '       $this->_foo = $foo;\n' +
    '   }\n' +
    '}',

    '<span class="storage class">class</span> <span class="entity name class">SomeThing</span>\n' +
    '{\n' +
    '   <span class="keyword">protected</span> <span class="variable dollar-sign">$</span><span class="variable">_foo</span>;\n' +
    '\n' +
    '   <span class="keyword">public</span> <span class="storage function">function</span> <span class="support magic">__construct</span>(<span class="variable dollar-sign">$</span><span class="variable">foo</span>)\n' +
    '   {\n' +
    '       <span class="variable dollar-sign">$</span><span class="variable">this</span><span class="keyword operator">-</span><span class="keyword operator">&gt;</span>_foo <span class="keyword operator">=</span> <span class="variable dollar-sign">$</span><span class="variable">foo</span>;\n' +
    '   }\n' +
    '}'
);

RainbowTester.run(
    'test new class',

    'new SomeClass();',

    '<span class="keyword new">new</span> <span class="support class">SomeClass</span>();'
);

RainbowTester.run(
    'test new namespace class',

    'new Sonic\\Database\\Query();',

    '<span class="keyword new">new</span> <span class="support class">Sonic</span>\\<span class="support class">Database</span>\\<span class="support class">Query</span>();'
);

RainbowTester.run(
    'test new class without parenthesis',

    'new Sonic\\Controller;',

    '<span class="keyword new">new</span> <span class="support class">Sonic</span>\\<span class="support class">Controller</span>;'
);

RainbowTester.run(
    'test static class call',

    '$path = Sonic\\App::getInstance()->getPath();',

    '<span class="variable dollar-sign">$</span><span class="variable">path</span> <span class="keyword operator">=</span> <span class="support class">Sonic</span>\\<span class="support class">App</span><span class="keyword static">::</span><span class="function call">getInstance</span>()<span class="keyword operator">-</span><span class="keyword operator">&gt;</span><span class="function call">getPath</span>();'
);

RainbowTester.run(
    'class constant',

    '$version = Sonic\\App::VERSION',

    '<span class="variable dollar-sign">$</span><span class="variable">version</span> <span class="keyword operator">=</span> <span class="support class">Sonic</span>\\<span class="support class">App</span><span class="keyword static">::</span><span class="constant">VERSION</span>'
);

RainbowTester.run(
    'static variable access',

    '$foo = Sonic\\App::$static_property;',

    '<span class="variable dollar-sign">$</span><span class="variable">foo</span> <span class="keyword operator">=</span> <span class="support class">Sonic</span>\\<span class="support class">App</span><span class="keyword static">::</span><span class="variable dollar-sign">$</span><span class="variable">static_property</span>;'
);

RainbowTester.run(
    'type hint',

    'public static function getForUser(User $user, Sort $sort) {}',

    '<span class="keyword">public</span> <span class="keyword">static</span> <span class="storage function">function</span> <span class="entity name function">getForUser</span>(<span class="support class">User</span> <span class="variable dollar-sign">$</span><span class="variable">user</span>, <span class="support class">Sort</span> <span class="variable dollar-sign">$</span><span class="variable">sort</span>) {}'
);


RainbowTester.run(
    'type hint with namespace',

    'public static function getForUser(\\SomeApp\\User $user) {}',

    '<span class="keyword">public</span> <span class="keyword">static</span> <span class="storage function">function</span> <span class="entity name function">getForUser</span>(\\<span class="support class">SomeApp</span>\\<span class="support class">User</span> <span class="variable dollar-sign">$</span><span class="variable">user</span>) {}'
);
RainbowTester.endTest('php');
