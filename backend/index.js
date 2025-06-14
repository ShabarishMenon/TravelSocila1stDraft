// Entry point for the Express server
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve the uploads directory as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import and use the authentication routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Import and use the posts routes
const postRoutes = require('./routes/posts');
app.use('/api/posts', postRoutes);

// Import and use the users routes
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

// Placeholder route
app.get('/', (req, res) => {
  res.send('API is running');
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
