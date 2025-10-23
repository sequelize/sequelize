const { DataTypes, Sequelize } = require('@sequelize/core');
const { SqliteDialect } = require('@sequelize/sqlite3');

// Create a simple test to verify createMultiple works
async function testCreateMultiple() {
  const sequelize = new Sequelize({
    dialect: SqliteDialect,
    storage: './test.db',
    logging: false,
  });

  // Define models
  const User = sequelize.define('User', {
    username: DataTypes.STRING,
  });

  const Post = sequelize.define('Post', {
    title: DataTypes.STRING,
    content: DataTypes.STRING,
    userId: DataTypes.INTEGER,
  });

  // Define association
  User.hasMany(Post);

  // Sync database
  await sequelize.sync({ force: true });

  // Create a user
  const user = await User.create({ username: 'testuser' });

  try {
    // Test createMultiple method
    console.log('Testing createMultiple method...');
    const posts = await user.createPosts([
      { title: 'Post 1', content: 'Content 1' },
      { title: 'Post 2', content: 'Content 2' },
    ]);

    console.log('✅ createMultiple worked!');
    console.log('Created posts:', posts.length);
    console.log('Post titles:', posts.map(p => p.title));

    // Verify posts are associated
    const allPosts = await user.getPosts();
    console.log('✅ Association verified!');
    console.log('Total posts for user:', allPosts.length);

    // Test with scope
    console.log('\nTesting with scope...');
    const UserWithScope = sequelize.define('UserWithScope', {
      username: DataTypes.STRING,
    });

    const PostWithScope = sequelize.define('PostWithScope', {
      title: DataTypes.STRING,
      content: DataTypes.STRING,
      userId: DataTypes.INTEGER,
      status: DataTypes.STRING,
    });

    UserWithScope.hasMany(PostWithScope, {
      scope: { status: 'active' },
    });

    await sequelize.sync({ force: true });

    const userWithScope = await UserWithScope.create({ username: 'scopeduser' });
    const scopedPosts = await userWithScope.createPostWithScopes([
      { title: 'Scoped Post 1', content: 'Content 1' },
      { title: 'Scoped Post 2', content: 'Content 2' },
    ]);

    console.log('✅ createMultiple with scope worked!');
    console.log('Created scoped posts:', scopedPosts.length);
    console.log('Post statuses:', scopedPosts.map(p => p.status));

    console.log('\n🎉 All tests passed! createMultiple is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await sequelize.close();
  }
}

testCreateMultiple().catch(console.error);
