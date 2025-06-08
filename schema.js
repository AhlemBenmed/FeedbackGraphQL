const { gql } = require('apollo-server');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Product, Feedback } = require('./models');
const { secret } = require('./auth');

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
    role: String!
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

  type AuthPayload {
    token: String!
    user: User!
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
    productByRating(rating: Float!): [Product]
    bestProducts: [Product]
  }

  type Mutation {
    register(name: String!, email: String!, password: String!,role: String!): AuthPayload
    login(email: String!, password: String!): AuthPayload

    addProduct(name: String!, description: String): Product
    addFeedback(productId: ID!, rating: Int!, comment: String): Feedback

    updateProduct(id: ID!, name: String, description: String): Product
    updateFeedback(id: ID!, rating: Int, comment: String): Feedback
    updateUser(id: ID!, name: String, email: String, role: String): User
    
    deleteProduct(id: ID!): Boolean
    deleteFeedback(id: ID!): Boolean
    deleteUser(id: ID!): Boolean
  }
`;

const resolvers = {
  Query: {
    users: async (_, __, { user }) => {
      if (!user || user.role !== 'admin') throw new Error('Unauthorized Only admins can view users');
      return await User.find();
    },
    user: async (_, { id }) => await User.findById(id),
    products: async () => {
      const products = await Product.find();
      for (const product of products) {
        await updateAverageRating(product._id);
      }
      return await Product.find();
    },
    product: async (_, { id }) => await Product.findById(id),
    feedbacks: async () => await Feedback.find(),
    feedback: async (_, { id }) => await Feedback.findById(id),
    feedbacksByUser: async (_, { userId }) => await Feedback.find({ userId }),
    feedbacksByProduct: async (_, { productId }) => await Feedback.find({ productId }),
    productByRating: async (_, { rating }) =>
      await Product.find({ averageRating: { $gte: rating - 0.01, $lte: rating + 0.01 } }),
    bestProducts: async () => await Product.find().sort({ averageRating: -1 }),
  },

  Mutation: {
    register: async (_, { name, email, password, role = 'user' }) => {
  const existing = await User.findOne({ email });
  if (existing) throw new Error("Email already registered");

  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ name, email, password: hashed, role });
  await user.save();

  const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET);
  return {
    token,
    user
  };
},

    login: async (_, { email, password }) => {
      const user = await User.findOne({ email });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new Error('Invalid credentials');
      }
      const token = jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '1d' });
      return { token, user };
    },

    addProduct: async (_, { name, description }, { user }) => {
      if (!user) throw new Error('Login required ');
      if (user.role !== 'admin') throw new Error('Only admins can add products');
      const product = new Product({ name, description });
      await product.save();
      return product;
    },

    addFeedback: async (_, { productId, rating, comment }, { user }) => {
      if (!user) throw new Error('Login required');
      if (user.role == 'admin') throw new Error('Only users can add feedback');
      if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5');
      const product = await Product.findById(productId);
      if (!product) throw new Error('Product not found');
      const feedback = new Feedback({
        userId: user._id,
        productId,
        rating,
        comment,
        date: new Date(),
      });
      await feedback.save();
      await updateAverageRating(productId);
      return feedback;
    },

    updateProduct: async (_, { id, name, description }, { user }) => {
      if (!user || user.role !== 'admin') throw new Error('Unauthorized');
      return await Product.findByIdAndUpdate(id, { name, description }, { new: true });
    },

    updateFeedback: async (_, { id, rating, comment }, { user }) => {
      const feedback = await Feedback.findById(id);
      if (!feedback || !user || feedback.userId.toString() !== user._id.toString())
        throw new Error('Unauthorized');
      feedback.rating = rating ?? feedback.rating;
      feedback.comment = comment ?? feedback.comment;
      await feedback.save();
      await updateAverageRating(feedback.productId);
      return feedback;
    },
    updateUser: async (_, { id, name, email, role }, { user }) => {
      if (!user || user.role !== 'admin') throw new Error('Unauthorized');
      const updatedUser = await User.findByIdAndUpdate(
        id,
        { name, email, role },
        { new: true }
      );
      if (!updatedUser) throw new Error('User not found');
      return updatedUser;
    }
,

    deleteProduct: async (_, { id }, { user }) => {
      if (!user || user.role !== 'admin') throw new Error('Unauthorized');
      await Product.findByIdAndDelete(id);
      return true;
    },

    deleteFeedback: async (_, { id }, { user }) => {
      const feedback = await Feedback.findById(id);
      if (!feedback || (!user || (user.role !== 'admin' && feedback.userId.toString() !== user._id.toString())))
        throw new Error('Unauthorized');
      await Feedback.findByIdAndDelete(id);
      await updateAverageRating(feedback.productId);
      return true;
    },
    deleteUser: async (_, { id }, { user }) => {
      if (!user || user.role !== 'admin') throw new Error('Unauthorized');
      const deletedUser = await User.findByIdAndDelete(id);
      if (!deletedUser) throw new Error('User not found');
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
    date: (feedback) => new Date(feedback.date).toLocaleDateString('en-GB').replace(/\//g, '-'),
  },
};

module.exports = { typeDefs, resolvers };
