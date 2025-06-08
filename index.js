const { ApolloServer } = require('apollo-server');
const connectDB = require('./db');
const { typeDefs, resolvers } = require('./schema');
const { getUserFromToken, secret } = require('./auth');
const jwt = require('jsonwebtoken');
async function startServer() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    const server = new ApolloServer({
      typeDefs,
      resolvers,
      context: ({ req }) => {
        const token = req.headers.authorization || '';
        try {
          const decoded = jwt.verify(token.replace('Bearer ', ''), secret);
          return { user: decoded };
        } catch {
          return {};
        }
      }
    });

    server.listen().then(({ url }) => {
      console.log( `🚀 Server ready at ${url}`);
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
  }
}

startServer();


