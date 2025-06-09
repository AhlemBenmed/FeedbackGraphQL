require('dotenv').config();
const jwt = require('jsonwebtoken');
const { User } = require('./models');
const secret = process.env.JWT_SECRET; 

const getUserFromToken = async (token) => {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id);
    return user;
  } catch (err) {
    return null;
  }
};

module.exports = { getUserFromToken, secret };