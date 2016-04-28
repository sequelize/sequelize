'use strict';

/* jshint -W110 */
var Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , Model = require(__dirname + '/../../../lib/model') 
  , util      = require('util')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , sql       = current.dialect.QueryGenerator;

suite(Support.getTestDialectTeaser('SQL'), function() {
  suite('bugTargetKeyWhereLimit', function () {
    var testsql = function (options, expectation) {
      var model = options.model;

      test(util.inspect(options, {depth: 2}), function () {
        return expectsql(
          sql.selectQuery(
            options.table || model && model.getTableName(),
            options,
            options.model
          ),
          expectation
        );
      });
    };

    var Tag = current.define('Tag', {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
      },
      type: {
        /* [ 'PRODUCT', 'USER_POST' ] */
        type: DataTypes.STRING
      },
      targetId: {
        type: DataTypes.BIGINT
      },
      keyword: {
        type: DataTypes.STRING(500),
        allowNull: false
      }
    });

    var Post = current.define('Post', {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ''
      }
    });

    var Product = current.define('Product', {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
      },
      token: {
        type: DataTypes.STRING,
        unique: true
      },
      price: {
        type: DataTypes.DECIMAL(20, 4),
        allowNull: false
      }
    });

    var PostProduct = current.define('PostProduct');

    Product.Tag = Product.hasOne(Tag, { foreignKey: 'targetId', constraints: false, scope: { type: 'PRODUCT' } });
    Tag.Product = Tag.belongsTo(Product, { foreignKey: 'targetId', constraints: false });

    Post.Tag = Post.hasOne(Tag, { as: 'userTag', foreignKey: 'targetId', constraints: false, scope: { type: 'USER_POST' } });
    Tag.UserPost = Tag.belongsTo(Post, { as: 'userPost', foreignKey: 'targetId', constraints: false });

    Post.Products = Post.belongsToMany(Product, { through: PostProduct });
    Product.Posts = Product.belongsToMany(Post, { through: PostProduct });

    var postProductInclude = Model.$validateIncludedElements({
      include: [{
        required: true,
        association: Post.Products,
        where: {
          price: { $gte: 10000 }
        }
      }],
      model: Post
    }).include;

    var postInclude = Model.$validateIncludedElements({
      include: [{
        required: true,
        association: Tag.UserPost,
        include: postProductInclude
      }],
      model: Tag
    }).include;

    testsql({
      model: Tag,
      where: {
        type: 'USER_POST'
      },
      include: postInclude,
      limit: 1
    }, {
      default: "SELECT `Tag`.*, `userPost`.`id` AS `userPost.id`, `userPost`.`type` AS `userPost.type`, `userPost`.`content` AS `userPost.content`, `userPost`.`createdAt` AS `userPost.createdAt`, `userPost`.`updatedAt` AS `userPost.updatedAt`, `userPost.Products`.`id` AS `userPost.Products.id`, `userPost.Products`.`token` AS `userPost.Products.token`, `userPost.Products`.`price` AS `userPost.Products.price`, `userPost.Products`.`createdAt` AS `userPost.Products.createdAt`, `userPost.Products`.`updatedAt` AS `userPost.Products.updatedAt`, `userPost.Products.PostProduct`.`createdAt` AS `userPost.Products.PostProduct.createdAt`, `userPost.Products.PostProduct`.`updatedAt` AS `userPost.Products.PostProduct.updatedAt`, `userPost.Products.PostProduct`.`ProductId` AS `userPost.Products.PostProduct.ProductId`, `userPost.Products.PostProduct`.`PostId` AS `userPost.Products.PostProduct.PostId` FROM `Tags` AS `Tag` INNER JOIN `Posts` AS `userPost` ON `Tag`.`targetId` = `userPost`.`id` INNER JOIN (`PostProducts` AS `userPost.Products.PostProduct` INNER JOIN `Products` AS `userPost.Products` ON `userPost.Products`.`id` = `userPost.Products.PostProduct`.`ProductId`) ON `userPost`.`id` = `userPost.Products.PostProduct`.`PostId` AND `userPost.Products`.`price` >= 10000 WHERE `Tag`.`type` = 'USER_POST' LIMIT 1;"
    });

    testsql({
      model: Tag,
      where: {
        type: 'USER_POST'
      },
      include: postInclude,
      subQuery: true,
      limit: 1
    }, {
      default: "SELECT `Tag`.*, `userPost`.`id` AS `userPost.id`, `userPost`.`type` AS `userPost.type`, `userPost`.`content` AS `userPost.content`, `userPost`.`createdAt` AS `userPost.createdAt`, `userPost`.`updatedAt` AS `userPost.updatedAt`, `userPost.Products`.`id` AS `userPost.Products.id`, `userPost.Products`.`token` AS `userPost.Products.token`, `userPost.Products`.`price` AS `userPost.Products.price`, `userPost.Products`.`createdAt` AS `userPost.Products.createdAt`, `userPost.Products`.`updatedAt` AS `userPost.Products.updatedAt`, `userPost.Products.PostProduct`.`createdAt` AS `userPost.Products.PostProduct.createdAt`, `userPost.Products.PostProduct`.`updatedAt` AS `userPost.Products.PostProduct.updatedAt`, `userPost.Products.PostProduct`.`ProductId` AS `userPost.Products.PostProduct.ProductId`, `userPost.Products.PostProduct`.`PostId` AS `userPost.Products.PostProduct.PostId` FROM (SELECT `Tag`.* FROM `Tags` AS `Tag` WHERE `Tag`.`type` = 'USER_POST' AND ( SELECT `Post`.`id` FROM `Posts` AS `Post` INNER JOIN (`PostProducts` AS `Products.PostProduct` INNER JOIN `Products` AS `Products` ON `Products`.`id` = `Products.PostProduct`.`ProductId`) ON `Post`.`id` = `Products.PostProduct`.`PostId` AND `Products`.`price` >= 10000 WHERE `Tag`.`targetId` = `Post`.`id` LIMIT 1 ) IS NOT NULL LIMIT 1) AS `Tag` INNER JOIN `Posts` AS `userPost` ON `Tag`.`targetId` = `userPost`.`id` INNER JOIN (`PostProducts` AS `userPost.Products.PostProduct` INNER JOIN `Products` AS `userPost.Products` ON `userPost.Products`.`id` = `userPost.Products.PostProduct`.`ProductId`) ON `userPost`.`id` = `userPost.Products.PostProduct`.`PostId` AND `userPost.Products`.`price` >= 10000;"
    });
  });
});
