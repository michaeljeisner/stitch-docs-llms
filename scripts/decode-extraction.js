const fs = require('fs');
const path = require('path');

const encodedPath = path.join(__dirname, '..', 'data', 'stitch-docs.encoded.json');
const decodedPath = path.join(__dirname, '..', 'data', 'stitch-docs.extracted.json');

const encoded = JSON.parse(fs.readFileSync(encodedPath, 'utf8').replace(/^\uFEFF/, ''));
if (encoded.encoding !== 'base64-json-v1' || !encoded.base64) {
  throw new Error('Unexpected extraction encoding wrapper.');
}

const decoded = Buffer.from(encoded.base64, 'base64').toString('utf8');
JSON.parse(decoded);
fs.writeFileSync(decodedPath, `${decoded}\n`, 'utf8');
console.log(`Decoded ${decodedPath}`);
