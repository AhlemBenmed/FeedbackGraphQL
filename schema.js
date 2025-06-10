require('dotenv').config();
const { gql } = require('apollo-server');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const cron = require('node-cron');
const { User, Product, Feedback, AuditLog } = require('./models');
const { secret } = require('./auth');

// Email transporter (configure with real credentials)
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const updateAverageRating = async (productId) => {
  const feedbacks = await Feedback.find({ productId });
  const avg = feedbacks.length === 0
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
    verified: Boolean
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
    me: User
  }

  type Mutation {
    register(name: String!, email: String!, password: String!, role: String!): AuthPayload
    sendVerificationEmail(email: String!): String
    verifyEmail(token: String!): String
    login(email: String!, password: String!): AuthPayload
    requestPasswordReset(email: String!): String
    resetPassword(token: String!, newPassword: String!): String

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
      if (!user || user.role !== 'admin') throw new Error('Unauthorized');
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
    me: async (_, __, { user }) => {
      if (!user) throw new Error('Unauthorized');
      return await User.findById(user.id);
    }
  },

  Mutation: {
    register: async (_, { name, email, password, role }) => {
      const existing = await User.findOne({ email });
      if (existing) throw new Error('Email already registered');
      const hashed = await bcrypt.hash(password, 10);
      const verificationToken = crypto.randomBytes(32).toString('hex');

      const user = new User({ name, email, password: hashed, role, verified: false, verificationToken });
      await user.save();

      // Call sendVerificationEmail after registration
      await resolvers.Mutation.sendVerificationEmail(_, { email });

      const token = jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '1d' });
      await logAudit(user, 'register', `User registered with email: ${email}`);
      return { token, user };
    },

    sendVerificationEmail: async (_, { email }) => {
      const user = await User.findOne({ email });
      if (!user) return 'If the email exists, a verification email has been sent.';
      if (user.verified) return 'Email is already verified.';
      const verificationToken = user.verificationToken || crypto.randomBytes(32).toString('hex');
      user.verificationToken = verificationToken;
      await user.save();
      await transporter.sendMail({
        from: 'NeedYourFeedback <codeninjas.tekup@gmail.com>',
        to: email,
        subject: 'Verify your email',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; border: 1px solid #eee; padding: 24px; border-radius: 8px;">
            <h2 style="color: #4CAF50;">Welcome to Feedback App!</h2>
            <p>Thank you for registering. Please verify your email by copying the token and pasting it in the app:</p>
            <pre style="display: inline-block; background: #4CAF50; color: #fff; padding: 12px 24px; border-radius: 4px; font-size: 2em; margin: 16px 0;">${verificationToken}</pre>
            <p style="color: #888; font-size: 0.9em;">If you did not request this, please ignore this email.</p>
          </div>
        `
      });
      return 'Verification email sent.';
    },

    verifyEmail: async (_, { token }) => {
      const user = await User.findOne({ verificationToken: token });
      if (!user) throw new Error('Invalid or expired token');
      user.verified = true;
      user.verificationToken = undefined;
      await user.save();
      return 'Email verified successfully.';
    },

    login: async (_, { email, password }) => {
      const user = await User.findOne({ email });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new Error('Invalid credentials');
      }
      if (!user.verified) throw new Error('Email not verified');
      const token = jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '1d' });
      return { token, user };
    },

    requestPasswordReset: async (_, { email }) => {
      const user = await User.findOne({ email });
      if (!user) return 'If the email exists, a password reset email has been sent.';
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.resetToken = resetToken;
      user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
      await user.save();
      await transporter.sendMail({
        from: 'NeedYourFeedback <codeninjas.tekup@gmail.com>',
        to: email,
        subject: 'Reset your password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; border: 1px solid #eee; padding: 24px; border-radius: 8px;">
            <h2 style="color: #2196F3;">Password Reset Request</h2>
            <p>We received a request to reset your password. Copy the token to reset your password and paste this token in the app:</p>
            <pre style="display: inline-block; background: #2196F3; color: #fff; padding: 12px 24px; border-radius: 4px; font-size: 2em; margin: 16px 0;">${resetToken}</pre>
            <p style="color: #888; font-size: 0.9em;">If you did not request this, you can safely ignore this email.</p>
          </div>
        `
      });
      return 'Password reset email sent.';
    },

    resetPassword: async (_, { token, newPassword }) => {
      const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: Date.now() } });
      if (!user) throw new Error('Invalid or expired token');
      user.password = await bcrypt.hash(newPassword, 10);
      user.resetToken = undefined;
      user.resetTokenExpiry = undefined;
      await user.save();
      return 'Password has been reset successfully.';
    },

    addProduct: async (_, { name, description }, { user }) => {
      if (!user || user.role !== 'admin') throw new Error('Unauthorized');
      const product = new Product({ name, description });
      await product.save();
      await logAudit(user, 'addProduct', `Added product: ${name}`);
      return product;
    },

    addFeedback: async (_, { productId, rating, comment }, { user }) => {
      if (!user || user.role === 'admin') throw new Error('Unauthorized');
      if (rating < 1 || rating > 5) throw new Error('Rating must be 1-5');
      const product = await Product.findById(productId);
      if (!product) throw new Error('Product not found');
      const feedback = new Feedback({
        userId: user.id,
        productId,
        rating,
        comment,
        date: new Date(),
      });
      await feedback.save();
      await updateAverageRating(productId);
      await logAudit(user, 'addFeedback', `Added feedback for product ${productId}: ${rating} stars`);
      return feedback;
    },

    updateProduct: async (_, { id, name, description }, { user }) => {
      if (!user || user.role !== 'admin') throw new Error('Unauthorized');
      return await Product.findByIdAndUpdate(id, { name, description }, { new: true });
    },

    updateFeedback: async (_, { id, rating, comment }, { user }) => {
      const feedback = await Feedback.findById(id);
      if (!feedback || feedback.userId.toString() !== user.id.toString()) throw new Error('Unauthorized');
      feedback.rating = rating ?? feedback.rating;
      feedback.comment = comment ?? feedback.comment;
      await feedback.save();
      await updateAverageRating(feedback.productId);
      await logAudit(user, 'updateFeedback', `Updated feedback ${id} for product ${feedback.productId}`);
      return feedback;
    },

    updateUser: async (_, { id, name, email, role }, { user }) => {
      if (!user || user.role !== 'admin') throw new Error('Unauthorized');
      return await User.findByIdAndUpdate(id, { name, email, role }, { new: true });
    },

    deleteProduct: async (_, { id }, { user }) => {
      if (!user || user.role !== 'admin') throw new Error('Unauthorized');
      await Product.findByIdAndDelete(id);
      await Feedback.deleteMany({ productId: id });
      await logAudit(user, 'deleteProduct', `Deleted product ${id}`);
      return true;
    },

    deleteFeedback: async (_, { id }, { user }) => {
      const feedback = await Feedback.findById(id);
      if (!feedback || (user.role !== 'admin' && feedback.userId.toString() !== user.id.toString()))
        throw new Error('Unauthorized');
      await Feedback.findByIdAndDelete(id);
      await updateAverageRating(feedback.productId);
      await logAudit(user, 'deleteFeedback', `Deleted feedback ${id} for product ${feedback.productId}`);
      return true;
    },

    deleteUser: async (_, { id }, { user }) => {
      if (!user || user.role !== 'admin') throw new Error('Unauthorized');
      await User.findByIdAndDelete(id);
      await Feedback.deleteMany({ userId: id });
      await logAudit(user, 'deleteUser', `Deleted user ${id}`);
      return true;
    }
  },

  Product: {
    feedbacks: async (product) => await Feedback.find({ productId: product.id }),
    averageRating: (product) => product.averageRating,
  },

  Feedback: {
    user: async (feedback) => await User.findById(feedback.userId),
    product: async (feedback) => await Product.findById(feedback.productId),
    date: (feedback) => new Date(feedback.date).toLocaleDateString('en-GB').replace(/\//g, '-'),
  }
};

const logAudit = async (user, action, details) => {
  try {
    await AuditLog.create({
      userId: user ? user.id : undefined,
      action,
      details
    });
  } catch (err) {
    console.error('AuditLog error:', err);
  }
};

cron.schedule('0 0 1 * *', async () => {
  console.log('🗑️ Monthly cleanup: removing products with all feedback ≤1');

  const products = await Product.find();
  for (const product of products) {
    const feedbacks = await Feedback.find({ productId: product._id });
    if (feedbacks.length > 3 && feedbacks.every(f => f.rating <= 1)) {
      await Feedback.deleteMany({ productId: product._id });
      await Product.findByIdAndDelete(product._id);
      await logAudit(null, 'monthlyCleanup', `Deleted product ${product._id} with all feedback ≤1`);
      console.log(`Deleted product ${product._id}`);
    }
  }
});

module.exports = { typeDefs, resolvers };
