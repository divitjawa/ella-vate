// Load the environment variables first
require('dotenv').config();

// Print the exact values (only for debugging purposes)
console.log('EXACT VALUES (for debugging only):');
console.log('PINECONE_API_KEY:', process.env.PINECONE_API_KEY);
console.log('PINECONE_INDEX:', process.env.PINECONE_INDEX);
console.log('PINECONE_ENVIRONMENT:', process.env.PINECONE_ENVIRONMENT);

// Read the .env file directly to see its raw contents
const fs = require('fs');
const path = require('path');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envPath)) {
  console.log('\nRaw .env file contents:');
  const envContent = fs.readFileSync(envPath, 'utf8');
  // Show only the lines containing PINECONE
  envContent.split('\n').forEach(line => {
    if (line.includes('PINECONE')) {
      console.log(line);
    }
  });
}
