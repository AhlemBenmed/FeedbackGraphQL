// index.js
const { ApolloServer } = require('apollo-server');
const connectDB = require('./db'); 
const { typeDefs, resolvers } = require('./schema');

async function startServer() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    const server = new ApolloServer({ typeDefs, resolvers });

    server.listen().then(({ url }) => {
      console.log(`🚀 Server ready at ${url}`);
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
  }
}

startServer();
