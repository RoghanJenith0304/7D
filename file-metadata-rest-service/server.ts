import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, query, orderBy } from 'firebase/firestore';

// Load Firebase config manually to avoid import issues in ESM
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Request logging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // Ensure uploads directory exists
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

  // Multer configuration
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({ storage: storage });

  // API Routes
  
  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  /**
   * @route POST /api/files/upload
   * @desc Upload a file and store its metadata
   */
  app.post('/api/files/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const metadata = {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadDate: new Date().toISOString(),
        path: req.file.path,
      };

      const docRef = await addDoc(collection(db, 'files'), metadata);
      
      res.status(201).json({
        message: 'File uploaded successfully',
        id: docRef.id,
        metadata
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Failed to upload file and store metadata' });
    }
  });

  /**
   * @route GET /api/files
   * @desc Retrieve all file metadata
   */
  app.get('/api/files', async (req, res) => {
    try {
      const q = query(collection(db, 'files'), orderBy('uploadDate', 'desc'));
      const querySnapshot = await getDocs(q);
      const files = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      res.json(files);
    } catch (error) {
      console.error('Error fetching files:', error);
      res.status(500).json({ error: 'Failed to retrieve file metadata' });
    }
  });

  /**
   * @route GET /api/files/:id
   * @desc Retrieve metadata for a specific file
   */
  app.get('/api/files/:id', async (req, res) => {
    try {
      const docRef = doc(db, 'files', req.params.id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        res.json({ id: docSnap.id, ...docSnap.data() });
      } else {
        res.status(404).json({ error: 'File metadata not found' });
      }
    } catch (error) {
      console.error('Error fetching file metadata:', error);
      res.status(500).json({ error: 'Failed to retrieve file metadata' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});

