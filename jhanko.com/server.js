const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

// Storage setup for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// In-memory ads store
let ads = [];
let adIdCounter = 1;

// Basic admin authentication middleware
const adminAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) {
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).send('Authentication required.');
  }
  const base64Credentials = auth.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  if (username === 'admin' && password === 'admin123') {
    next();
  } else {
    return res.status(403).send('Forbidden');
  }
};

// Route to submit ad (image/video/text)
app.post('/ads', upload.single('media'), (req, res) => {
  const { text } = req.body;
  const file = req.file;
  if (!text && !file) {
    return res.status(400).json({ error: 'Ad must contain text or media.' });
  }
  const ad = {
    id: adIdCounter++,
    text: text || null,
    media: file ? file.filename : null,
    mediaType: file ? file.mimetype : null,
    approved: false,
    createdAt: new Date()
  };
  ads.push(ad);
  res.status(201).json({ message: 'Ad submitted successfully', ad });
});

// Admin route to list all ads
app.get('/admin/ads', adminAuth, (req, res) => {
  res.json(ads);
});

// Admin route to approve ad
app.post('/admin/ads/:id/approve', adminAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const ad = ads.find(a => a.id === id);
  if (!ad) {
    return res.status(404).json({ error: 'Ad not found' });
  }
  ad.approved = true;
  res.json({ message: 'Ad approved', ad });
});

// Admin route to delete ad
app.delete('/admin/ads/:id', adminAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const index = ads.findIndex(a => a.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Ad not found' });
  }
  const ad = ads[index];
  if (ad.media) {
    const filePath = path.join(__dirname, 'uploads', ad.media);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  ads.splice(index, 1);
  res.json({ message: 'Ad deleted' });
});

// Admin route to download media
app.get('/admin/ads/:id/download', adminAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const ad = ads.find(a => a.id === id);
  if (!ad || !ad.media) {
    return res.status(404).json({ error: 'Media not found' });
  }
  const filePath = path.join(__dirname, 'uploads', ad.media);
  res.download(filePath);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
