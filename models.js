const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
});

const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  averageRating: {
    type: Number,
    default: 0,
  },
});

const feedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  rating: Number,
  comment: String,
  date: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = { User, Product, Feedback };