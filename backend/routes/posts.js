const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Post = require('../models/Post');
const User = require('../models/User');

const router = express.Router();

// Middleware to verify JWT
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Invalid token' });
    req.userId = decoded.userId;
    next();
  });
}

// Set up multer for file uploads
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({ storage });

// Create a post (text and optional photo)
router.post('/', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    const { text } = req.body;
    let photoUrl = null;
    if (req.file) {
      photoUrl = `/uploads/${req.file.filename}`;
    }
    if (!text && !photoUrl) return res.status(400).json({ message: 'Text or photo is required' });
    const post = new Post({ user: req.userId, text, photo: photoUrl });
    await post.save();
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all posts (feed)
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('user', 'username')
      .populate('comments.user', 'username')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Like a post
router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (!post.likes.includes(req.userId)) {
      post.likes.push(req.userId);
      await post.save();
    }
    res.json({ likes: post.likes });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Unlike a post
router.post('/:id/unlike', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    post.likes = post.likes.filter(id => id.toString() !== req.userId);
    await post.save();
    res.json({ likes: post.likes });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Save a post
router.post('/:id/save', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (!post.saves.includes(req.userId)) {
      post.saves.push(req.userId);
      await post.save();
    }
    res.json({ saves: post.saves });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Unsave a post
router.post('/:id/unsave', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    post.saves = post.saves.filter(id => id.toString() !== req.userId);
    await post.save();
    res.json({ saves: post.saves });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a comment to a post
router.post('/:id/comment', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'Comment text required' });
    post.comments.push({ user: req.userId, text });
    await post.save();
    await post.populate('comments.user', 'username');
    res.json({ comments: post.comments });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
