// db.js
const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://nourkhedri02:rV4hz0VXAvFSQHXM@cluster0.lf1h0.mongodb.net/FeedbackDB?retryWrites=true&w=majority';

const connectDB = () => {
  return mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
};


module.exports = connectDB;





