# Sub Queries

Consider you have two models, `Post` and `Reaction`, with a One-to-Many relationship set up, so that one post has many reactions:

```js
const Post = sequelize.define('post', {
    content: DataTypes.STRING
}, { timestamps: false });

const Reaction = sequelize.define('reaction', {
    type: DataTypes.STRING
}, { timestamps: false });

Post.hasMany(Reaction);
Reaction.belongsTo(Post);
```

*Note: we have disabled timestamps just to have shorter queries for the next examples.*

Let's fill our tables with some data:

```js
async function makePostWithReactions(content, reactionTypes) {
    const post = await Post.create({ content });
    await Reaction.bulkCreate(
        reactionTypes.map(type => ({ type, postId: post.id }))
    );
    return post;
}

await makePostWithReactions('Hello World', [
    'Like', 'Angry', 'Laugh', 'Like', 'Like', 'Angry', 'Sad', 'Like'
]);
await makePostWithReactions('My Second Post', [
    'Laugh', 'Laugh', 'Like', 'Laugh'
]);
```

Now, we are ready for examples of the power of subqueries.

Let's say we wanted to compute via SQL a `laughReactionsCount` for each post. We can achieve that with a sub-query, such as the following:

```sql
SELECT
    *,
    (
        SELECT COUNT(*)
        FROM reactions AS reaction
        WHERE
            reaction.postId = post.id
            AND
            reaction.type = "Laugh"
    ) AS laughReactionsCount
FROM posts AS post
```

If we run the above raw SQL query through Sequelize, we get:

```json
[
  {
    "id": 1,
    "content": "Hello World",
    "laughReactionsCount": 1
  },
  {
    "id": 2,
    "content": "My Second Post",
    "laughReactionsCount": 3
  }
]
```

So how can we achieve that with more help from Sequelize, without having to write the whole raw query by hand?

The answer: by combining the `attributes` option of the finder methods (such as `findAll`) with the `sequelize.literal` utility function, that allows you to directly insert arbitrary content into the query without any automatic escaping.

This means that Sequelize will help you with the main, larger query, but you will still have to write that sub-query by yourself:

```js
Post.findAll({
    attributes: {
        include: [
            [
                // Note the wrapping parentheses in the call below!
                sequelize.literal(`(
                    SELECT COUNT(*)
                    FROM reactions AS reaction
                    WHERE
                        reaction.postId = post.id
                        AND
                        reaction.type = "Laugh"
                )`),
                'laughReactionsCount'
            ]
        ]
    }
});
```

*Important Note: Since `sequelize.literal` inserts arbitrary content without escaping to the query, it deserves very special attention since it may be a source of (major) security vulnerabilities. It should not be used on user-generated content.* However, here, we are using `sequelize.literal` with a fixed string, carefully written by us (the coders). This is ok, since we know what we are doing.

The above gives the following output:

```json
[
  {
    "id": 1,
    "content": "Hello World",
    "laughReactionsCount": 1
  },
  {
    "id": 2,
    "content": "My Second Post",
    "laughReactionsCount": 3
  }
]
```

Success!

## Using sub-queries for complex ordering

This idea can be used to enable complex ordering, such as ordering posts by the number of laugh reactions they have:

```js
Post.findAll({
    attributes: {
        include: [
            [
                sequelize.literal(`(
                    SELECT COUNT(*)
                    FROM reactions AS reaction
                    WHERE
                        reaction.postId = post.id
                        AND
                        reaction.type = "Laugh"
                )`),
                'laughReactionsCount'
            ]
        ]
    },
    order: [
        [sequelize.literal('laughReactionsCount'), 'DESC']
    ]
});
```

Result:

```json
[
  {
    "id": 2,
    "content": "My Second Post",
    "laughReactionsCount": 3
  },
  {
    "id": 1,
    "content": "Hello World",
    "laughReactionsCount": 1
  }
]
```