const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not defined in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      // these options are safe defaults for mongoose 7+
      // useNewUrlParser and useUnifiedTopology are true by default in Mongoose 7
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message || err);
    // more detailed error for debugging (do not expose in production logs)
    console.error(err);
    process.exit(1);
  }

  // Optional: handle runtime errors
  mongoose.connection.on('error', (e) => {
    console.error('MongoDB runtime error:', e);
  });
};

module.exports = connectDB;
