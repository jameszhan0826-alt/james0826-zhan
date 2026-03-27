import fs from 'fs';

const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(/localStorage\.getItem/g, 'window.getStoreItem');
content = content.replace(/localStorage\.setItem/g, 'window.setStoreItem');
content = content.replace(/localStorage\.removeItem/g, 'window.removeStoreItem');

fs.writeFileSync(file, content, 'utf-8');
console.log('Replaced localStorage with window store functions');
