import fs from 'fs';
const DATA_FILE = '/Users/aistudio/Vocab Quest: Learn & Practice/store.json';
if (fs.existsSync(DATA_FILE)) {
  console.log('File exists:', fs.readFileSync(DATA_FILE, 'utf-8'));
} else {
  console.log('File does not exist');
}
