window.RainbowTester = (function() {
    var _language,
        queue = [],
        results = {};

    function _addScript(url, language) {
        var script = document.createElement('script');
        script.src = url + '?' + new Date().getTime();
        document.getElementsByTagName('body')[0].appendChild(script);
    }

    function _runTests(e) {
        var languages = $("select[name=languages]").val() || [],
            min = $("input[name=min]").attr("checked"),
            i;

        if (window.localStorage) {
            window.localStorage.setItem('languages', languages);
        }

        results = {};
        $('.global_toggle').show();
        $('#results').html('');


        // add rainbow
        _addScript(RAINBOW_PATH + '/rainbow.' + (min ? 'min.' : '') + 'js');

        // add all the languages
        $("select[name=languages] option").each(function() {
            _addScript(RAINBOW_PATH + '/language/' + this.value + '.js');
        });

        for (i = 0; i < languages.length; ++i) {
            _addScript('language/' + languages[i] + '-test.js', languages[i]);
        }

        setTimeout(_processQueue, 50);
    }

    function _toggleCode(e) {
        e.preventDefault();
        $(this).parents('li').find('.code').toggle();
    }

    function _globalToggleCode(e) {
        e.preventDefault();
        if ($(this).text() == 'expand all') {
            $(".code").show();
            return $(this).text('collapse all');
        }

        $(".code").hide();
        $(this).text('expand all');
    }

    function _initResults(language) {
        if (!results[language]) {
            results[language] = {};
        }
    }

    function _getTableRow(language, fail, pass) {
        return '<tr><td>' + language + '</td><td class="failure">' + fail + '</td><td class="success">' + pass + '</td></tr>';
    }

    function _showResults() {
        if (queue.length) {
            return _processQueue();
        }

        var table = '<table><tr><th>Language</th><th class="failure">Failed</th><th class="success">Passed</th></tr>',
            total_pass = 0,
            total_fail = 0;

        for (var lang in results) {
            var pass = 0,
                fail = 0;

            for (var key in results[lang]) {
                if (results[lang][key]['success']) {
                    ++pass;
                    continue;
                }
                ++fail;
            }

            total_pass += pass;
            total_fail += fail;

            table += _getTableRow(lang, fail, pass);
        }

        table += _getTableRow('<strong>total</strong>', total_fail, total_pass);
        table += '</table>';

        $("#results").append(table);
        _scroll();
    }

    function _scroll() {
        $(window).scrollTop($(document).height());
    }

    function _processQueue() {
        if (queue.length === 0) {
            return _showResults();
        }

        _scroll();

        var test = queue.shift();
        Rainbow.color(test['code'], test['language'], function(actual) {
            if (test['expected'] == actual) {
                _pass(test['language'], test['name'], actual);
                return _processQueue();
            }
            _fail(test['language'], test['name'], test['expected'], actual);
            _processQueue();
        });
    }

    function _pass(language, test_name, actual) {
        _initResults(language);
        results[language][test_name] = {
            success: true,
            actual: actual
        };

        $('#' + language).append(
            '<li class="success">' +
                '<h5><a href="#" class="toggle">' + test_name + '</a></h5>' +
                '<div class="code">' +
                    '<pre><code>' + actual + '</code></pre>' +
                '</div>' +
            '</li>'
        );
    }

    function _fail(language, test_name, expected, actual) {
        _initResults(language);
        results[language][test_name] = {
            success: false,
            expected: expected,
            actual: actual
        };


        $('#' + language).append(
            '<li class="failure">' +
                '<h5><a href="#" class="toggle">' + test_name + '</a></h5>' +
                '<div class="code">' +
                    '<h6>Expected:</h6>' +
                    '<pre><code>' + expected + '</code></pre>' +
                    '<h6>Actual:</h6>' +
                    '<pre><code>' + actual + '</code></pre>' +
                '</div>' +
            '</li>'
        );
        actual = actual.replace(/\n/g, '\\n\' + \n' + '\'');
        console.log('\'' + actual + '\'');
    }

    function _restoreLanguagesFromLastRun() {
        if (!window.localStorage) {
            return;
        }

        var languages = window.localStorage.getItem('languages').split(',');
        $("select[name=languages] option").each(function() {
            if ($.inArray(this.value, $(languages)) === -1) {
                $(this).attr("selected", false);
            }
        });
    }

    return {
        init: function() {
            $("#run_tests").click(_runTests);
            $("#results").on('click', '.toggle', _toggleCode);
            $("body").on('click', '.global_toggle', _globalToggleCode);
            $(document).keyup(function(e) {
                if (e.keyCode == 79) {
                    $(".global_toggle").click();
                }

                if (e.keyCode == 82) {
                    $("#run_tests").click();
                }
            });
            _restoreLanguagesFromLastRun();
        },

        startTest: function(name) {
            _language = name;
            $("#results").append('<h3>' + _language + '</h3><ul id="' + _language + '"></ul>');
        },

        endTest: function(name) {
            _language = null;
        },

        run: function(test_name, code, expected) {
            var language = _language;

            queue.push({
                'language': _language,
                'name': test_name,
                'code': code,
                'expected': expected
            });
        }
    };
}) ();

$(document).ready(RainbowTester.init);
