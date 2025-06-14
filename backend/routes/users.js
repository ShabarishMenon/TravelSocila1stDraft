const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Post = require('../models/Post'); // Import Post model

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

// Set up multer for avatar uploads
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

// Get current user's profile (bio, avatar, etc.)
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      bio: user.bio || '',
      avatar: user.avatar || null,
      location: user.location || '',
      trips: user.trips || 0,
      reviews: user.reviews || 0,
      years: user.years || 0,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile (bio and avatar)
router.put('/profile', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    const { bio } = req.body;
    let avatarUrl = null;
    let oldAvatar = null;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (req.file) {
      avatarUrl = `/uploads/${req.file.filename}`;
      oldAvatar = user.avatar;
    }
    // Remove old avatar file if a new one is uploaded
    if (oldAvatar && avatarUrl && oldAvatar.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', oldAvatar);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
    if (bio !== undefined) user.bio = bio;
    if (avatarUrl) user.avatar = avatarUrl;
    await user.save();
    res.json({ bio: user.bio || '', avatar: user.avatar || null });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Search users by name, username, or email
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q) return res.json([]);
    const regex = new RegExp(q, 'i');
    const users = await User.find({
      $or: [
        { username: regex },
        { email: regex },
        { bio: regex },
        { name: regex }, // add name field for search if present
      ],
    }).select('_id username email bio avatar');
    // Only return users that are not the current user
    const filtered = users.filter(u => u._id.toString() !== req.userId);
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Follow a user
router.post('/:id/follow', authMiddleware, async (req, res) => {
  try {
    const userToFollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.userId);
    if (!userToFollow || !currentUser) return res.status(404).json({ message: 'User not found' });
    if (userToFollow._id.equals(currentUser._id)) return res.status(400).json({ message: 'Cannot follow yourself' });
    if (currentUser.following.includes(userToFollow._id)) return res.status(400).json({ message: 'Already following' });
    currentUser.following.push(userToFollow._id);
    userToFollow.followers.push(currentUser._id);
    await currentUser.save();
    await userToFollow.save();
    res.json({ message: 'Followed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Unfollow a user
router.post('/:id/unfollow', authMiddleware, async (req, res) => {
  try {
    const userToUnfollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.userId);
    if (!userToUnfollow || !currentUser) return res.status(404).json({ message: 'User not found' });
    if (userToUnfollow._id.equals(currentUser._id)) return res.status(400).json({ message: 'Cannot unfollow yourself' });
    currentUser.following = currentUser.following.filter(id => !id.equals(userToUnfollow._id));
    userToUnfollow.followers = userToUnfollow.followers.filter(id => !id.equals(currentUser._id));
    await currentUser.save();
    await userToUnfollow.save();
    res.json({ message: 'Unfollowed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get posts from users the current user is following (and their own posts)
router.get('/feed', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const followingIds = user.following.map(id => id.toString());
    followingIds.push(user._id.toString()); // include own posts
    const posts = await Post.find({ user: { $in: followingIds } })
      .populate('user', 'username')
      .populate('comments.user', 'username')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get any user's public profile by ID
router.get('/profile/:id', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      username: user.username,
      email: user.email,
      bio: user.bio || '',
      avatar: user.avatar || null,
      location: user.location || '',
      trips: user.trips || 0,
      reviews: user.reviews || 0,
      years: user.years || 0,
      followers: user.followers || [],
      following: user.following || [],
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
