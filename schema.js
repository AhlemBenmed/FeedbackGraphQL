const { gql } = require('apollo-server');
const { User, Product, Feedback } = require('./models');

// Helper to recalculate and update the cached average rating
const updateAverageRating = async (productId) => {
  const feedbacks = await Feedback.find({ productId });
  const avg =
    feedbacks.length === 0
      ? 0
      : feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length;

  await Product.findByIdAndUpdate(productId, { averageRating: avg });
};

const typeDefs = gql`
  type User {
    id: ID!
    name: String!
    email: String!
    feedbacks: [Feedback]
  }

  type Product {
    id: ID!
    name: String!
    description: String
    feedbacks: [Feedback]
    averageRating: Float
  }

  type Feedback {
    id: ID!
    user: User!
    product: Product!
    rating: Int!
    comment: String
    date: String
  }

  type Query {
    products: [Product]
    product(id: ID!): Product
    feedbacks: [Feedback]
    feedback(id: ID!): Feedback
    feedbacksByProduct(productId: ID!): [Feedback]
    feedbacksByUser(userId: ID!): [Feedback]
    users: [User]
    user(id: ID!): User
  }

  type Mutation {
    # Create
    addUser(name: String!, email: String!): User
    addProduct(name: String!, description: String): Product
    addFeedback(userId: ID!, productId: ID!, rating: Int!, comment: String): Feedback

    # Update
    updateUser(id: ID!, name: String, email: String): User
    updateProduct(id: ID!, name: String, description: String): Product
    updateFeedback(id: ID!, rating: Int, comment: String): Feedback

    # Delete by ID
    deleteUser(id: ID!): Boolean
    deleteProduct(id: ID!): Boolean
    deleteFeedback(id: ID!): Boolean

    # Delete all
    deleteAllUsers: Boolean
    deleteAllProducts: Boolean
    deleteAllFeedbacks: Boolean
  }
`;

const resolvers = {
  Query: {
    users: async () => await User.find(),
    user: async (_, { id }) => await User.findById(id),
    products: async () => await Product.find(),
    product: async (_, { id }) => await Product.findById(id),
    feedbacks: async () => await Feedback.find(),
    feedback: async (_, { id }) => await Feedback.findById(id),
    feedbacksByUser: async (_, { userId }) => await Feedback.find({ userId }),
    feedbacksByProduct: async (_, { productId }) => await Feedback.find({ productId }),
  },

  Mutation: {
    // Create
    addUser: async (_, { name, email }) => {
      const user = new User({ name, email });
      await user.save();
      return user;
    },

    addProduct: async (_, { name, description }) => {
      const product = new Product({ name, description, averageRating: 0 });
      await product.save();
      return product;
    },

    addFeedback: async (_, { userId, productId, rating, comment }) => {
      const user = await User.findById(userId);
      const product = await Product.findById(productId);
      if (!user || !product) throw new Error("User or Product not found");

      const feedback = new Feedback({
        userId,
        productId,
        rating,
        comment,
        date: new Date().toISOString(),
      });
      await feedback.save();
      await updateAverageRating(productId);
      return feedback;
    },

    // Update
    updateUser: async (_, { id, name, email }) => {
      return await User.findByIdAndUpdate(id, { name, email }, { new: true });
    },

    updateProduct: async (_, { id, name, description }) => {
      return await Product.findByIdAndUpdate(id, { name, description }, { new: true });
    },

    updateFeedback: async (_, { id, rating, comment }) => {
      const feedback = await Feedback.findByIdAndUpdate(id, { rating, comment }, { new: true });
      if (feedback) await updateAverageRating(feedback.productId);
      return feedback;
    },

    // Delete by ID
    deleteUser: async (_, { id }) => {
      const result = await User.findByIdAndDelete(id);
      return !!result;
    },

    deleteProduct: async (_, { id }) => {
      const result = await Product.findByIdAndDelete(id);
      return !!result;
    },

    deleteFeedback: async (_, { id }) => {
      const feedback = await Feedback.findByIdAndDelete(id);
      if (feedback) await updateAverageRating(feedback.productId);
      return !!feedback;
    },

    // Delete All
    deleteAllUsers: async () => {
      await User.deleteMany();
      return true;
    },

    deleteAllProducts: async () => {
      await Product.deleteMany();+
      return true;
    },

    deleteAllFeedbacks: async () => {
      await Feedback.deleteMany();
      // Reset all product ratings
      const products = await Product.find();
      for (const product of products) {
        await updateAverageRating(product._id);
      }
      return true;
    },
  },

  Product: {
    feedbacks: async (product) => await Feedback.find({ productId: product.id }),
    averageRating: (product) => product.averageRating,
  },

  Feedback: {
    user: async (feedback) => await User.findById(feedback.userId),
    product: async (feedback) => await Product.findById(feedback.productId),
    date: (feedback) => {
      const d = new Date(feedback.date);
      return d.toLocaleDateString('en-GB').replace(/\//g, '-');
    },
  },
};

module.exports = { typeDefs, resolvers };
