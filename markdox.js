var markdox = require('markdox');

var options = {
  output: 'output.md',
  formatter: function (docfile) {
    docfile = markdox.defaultFormatter(docfile);

    docfile.javadoc.forEach(function(javadoc, index){
      var isConstructor = false;

      javadoc.raw.tags.forEach(function(tag){
        if (tag.type == 'constructor') {
          isConstructor = true
        }
      });


      docfile.javadoc[index].isConstructor = isConstructor;
    });

    return docfile;
  },
  template: 'output.md.ejs'
};

markdox.process('./lib/sequelize.js', options, function(){
  console.log('File `all.md` generated with success');
});