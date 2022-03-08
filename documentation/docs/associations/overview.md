---
sidebar_position: 1
sidebar_label: Overview
---

# Associations Overview

Sequelize supports the standard data model relationships:

- [One-To-One](./one-to-one.mdx) relationships, represented in Sequelize by `HasOne` and `BelongsTo` associations,
- [One-To-Many](./one-to-many.mdx) relationships, represented in Sequelize by `HasMany` and `BelongsTo` associations,
- and [Many-To-Many](./many-to-many.mdx) relationships, represented in Sequelize by `BelongsToMany` associations.

The guide will start explaining how to define these four associations types,
and then will follow up to explain how to combine those to define the three standard association types.

## Defining Associations

The four association types are defined in a very similar way.
Let's say we have two models, A and B.
Telling Sequelize that you want an association between the two is done by call a static method on your model:

```js
const A = sequelize.define('A', /* ... */);
const B = sequelize.define('B', /* ... */);

A.hasOne(B); // A HasOne B
A.belongsTo(B); // A BelongsTo B
A.hasMany(B); // A HasMany B
A.belongsToMany(B, { through: 'C' }); // A BelongsToMany B through the junction table C
```

The model on which in which the static method is called is relevant. In other words, `A.hasOne(B)` is **not** equivalent to `B.hasOne(A)`.

In all examples above, `A` is called the **source** model and `B` is called the **target** model. This terminology is important.

:::info

These 4 method calls will cause Sequelize to automatically add foreign keys on the appropriate models (unless they are already present).

:::

Read more one how to define each relationship:

- [One-To-One](./one-to-one.mdx)
- [One-To-Many](./one-to-many.mdx)
- [Many-To-Many](./many-to-many.mdx)
