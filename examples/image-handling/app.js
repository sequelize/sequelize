var fs        = require("fs")
  , Sequelize = require("sequelize")
  , sequelize = new Sequelize('sequelize_test', 'root', null, {logging: false})
  , Image     = sequelize.define('Image', { data: Sequelize.TEXT })

Image.sync({force: true}).on('success', function() {
  console.log("reading image")
  var image = fs.readFileSync(__dirname + '/source.png').toString("base64")
  console.log("done\n")
  
  console.log("creating database entry")
  Image.create({data: image}).on('success', function(img) {
    console.log("done\n")
    
    console.log("writing file")
    fs.writeFileSync(__dirname + '/target.png', img.data, "base64")
    console.log("done\n")
    
    console.log("you might open the file ./target.png")
  })
})