import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

const DATA_DIR = path.join(process.cwd(), 'vocab');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Migrate old data if it exists
const OLD_DATA_FILE = '/Users/aistudio/vocab/store.json';
if (fs.existsSync(OLD_DATA_FILE)) {
  try {
    const oldData = JSON.parse(fs.readFileSync(OLD_DATA_FILE, 'utf-8'));
    for (const [key, value] of Object.entries(oldData)) {
      const filePath = path.join(DATA_DIR, `${key}.json`);
      if (!fs.existsSync(filePath)) {
        let formattedValue = value as string;
        try {
          const parsed = JSON.parse(value as string);
          formattedValue = JSON.stringify(parsed, null, 2);
        } catch (e) {
          // Not JSON, just write as is
        }
        fs.writeFileSync(filePath, formattedValue, 'utf-8');
      }
    }
    // Rename old file so we don't migrate again
    fs.renameSync(OLD_DATA_FILE, OLD_DATA_FILE + '.migrated');
    console.log('Successfully migrated old store.json data to individual files.');
  } catch (e) {
    console.error('Failed to migrate old data:', e);
  }
}

app.get('/api/store', (req, res) => {
  try {
    const data: Record<string, string> = {};
    const files = fs.readdirSync(DATA_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const key = file.slice(0, -5); // remove .json
        const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
        // If it's a valid JSON string, we just send it back as a string,
        // because the client expects the value to be a string (which it will JSON.parse if needed).
        // Wait, if we wrote it as JSON, we should read it as a string.
        // Let's just read the raw string. If it's a JSON string, it's fine.
        // Actually, if we write the value directly, we can just read it.
        data[key] = content;
      }
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to read store' });
  }
});

app.post('/api/store/bulk', (req, res) => {
  try {
    const { data } = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid data' });
    }

    for (const [key, value] of Object.entries(data)) {
      const filePath = path.join(DATA_DIR, `${key}.json`);
      if (value === null) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } else {
        let formattedValue = value as string;
        try {
          const parsed = JSON.parse(value as string);
          formattedValue = JSON.stringify(parsed, null, 2);
        } catch (e) {
          // Not JSON
        }
        fs.writeFileSync(filePath, formattedValue, 'utf-8');
      }
    }
    res.json({ success: true });
  } catch (e) {
    console.error('Bulk store error:', e);
    res.status(500).json({ error: 'Failed to write bulk store' });
  }
});

app.post('/api/store', (req, res) => {
  try {
    const { key, value } = req.body;
    const filePath = path.join(DATA_DIR, `${key}.json`);
    
    if (value === null) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } else {
      // value is a string. If it's a JSON string, we can format it nicely.
      let formattedValue = value;
      try {
        const parsed = JSON.parse(value);
        formattedValue = JSON.stringify(parsed, null, 2);
      } catch (e) {
        // Not JSON, just write as is
      }
      fs.writeFileSync(filePath, formattedValue, 'utf-8');
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to write store' });
  }
});

async function startServer() {
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
