const { ApolloServer } = require('apollo-server');
const connectDB = require('./db');
const { typeDefs, resolvers } = require('./schema');
const { getUserFromToken } = require('./auth');

async function startServer() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    const server = new ApolloServer({
      typeDefs,
      resolvers,
      context: async ({ req }) => {
        const token = req.headers.authorization?.split(' ')[1];
        const user = await getUserFromToken(token);
        return { user };
      },
    });

    server.listen().then(({ url }) => {
      console.log( `Server ready at ${url}`);
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
  }
}

startServer();


