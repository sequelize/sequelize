# Associations: Many-to-Many  

The next most common association is a many-to-many association also called a "has-and-belongs-to-many" association. We accomplish this via using a join table.

## Associating Two Tables

Here is an example using Users and Events.

Use the `.belongsToMany()` function to define the association on both models:

```js
Event.belongsToMany(User, { through: 'rsvps' })
User.belongsToMany(Event, { through: 'rsvps', foreignKey: 'GuestId', as: 'Guests' })
```

Create a `rsvps` table with two foreign keys

```
createdAt | updatedAt | GuestId | EventId
```

Use the getters and setters sequelize makes available:

```js
User.getEvents();
Event.getGuests();
// etc
```

## Self-Referential Many-to-Many Association

It is also common to have one resource have and belong to many of itself, such as friends in Facebook or followers in Twitter. This is accomplished by defining an alias using the `as` option.

```js
Item.hasMany(Item, { as: 'Subitems' }) // Subitems are instances of the Item model

Item.find({ where: { name: "Coffee" }, include: [ { model: Item, as: 'Subitems' } ] })
```

```
createdAt | updatedAt | ItemId | SubItemId
```

Bi-Directional - Use `foreignKey` & `through`

```js
User.hasMany(User, {
    as: 'Friends',
    foreignKey: 'FriendId',
    through: 'friends'
})

User.getFriends()
```

Create a `friends` table

```
createdAt | updatedAt | UserId | FriendId
```

```js
User.hasMany(User, { // who follows you
  as: 'Followers',
  foreignKey: 'FollowId',
  through: 'follows'
})

User.hasMany(User, { // who you follow
  as: 'Follows',
  foreignKey: 'FollowerId',
  through: 'follows'
})

User.getFollows();
User.getFollowers();
```

Create a `follows` table

```
createdAt | updatedAt | FollowId | FollowerId
```

## Fetching Associated Records

```js
pug.getFriends() // returns a promise for the array of friends for that pug
pug.addFriend(friend) // creates a new row in the friendship table for the pug and the friend, returns a promise for the friendship (NOT the pug OR the friend - the "friendship")
pug.addFriends(friendsArray) // creates a new row in the friendship table for each friend, returns a promise for the friendship
pug.removeFriend(friend) // removes the row from the friendship table for that pug-friend, returns a promise for the number of affected rows (as if you'd want to destroy any friendships...right?)
pug.removeFriends(friendsArray) // removes the rows from the friendship table for those pug-friend pairs, returns a promise for the number affected rows

// analogous to above ^
friend.getPugs()
friend.addPug(pug)
friend.addPugs(pugsArray)
friend.setPugs(pugsArray)
friend.removePug(pug)
friend.removePugs(pugsArray)
```
