require.config({
    paths: {
        text: '../../../text/text'
    }
});

require(['main'], function(main) {

    var subRegExp = /\/sub$/,
        nestedRegExp = /\/sub\/nested$/;

    doh.register(
        "toUrl",
        [
            function toUrl(t){
                t.is(".hidden", main.hidden);
                t.is("main.html", main.html);
                t.is("noext", main.noext);
                t.is("aux", main.util.auxHtml);
                t.is(true, subRegExp.test(main.util.dotPath));
                t.is("util", main.util.html);

                t.is(true, nestedRegExp.test(main.util.thing.dirPath));
                t.is(true, subRegExp.test(main.util.thing.parentPath));
                t.is("noext", main.util.thing.noext);
            }
        ]
    );
    doh.run();
});
