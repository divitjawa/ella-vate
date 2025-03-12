require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');

async function testConnection() {
  try {
    console.log('Testing connection with:');
    console.log('- API Key:', process.env.PINECONE_API_KEY ? 'Set' : 'Not set');
    console.log('- Index:', process.env.PINECONE_INDEX);
    
    // Initialize Pinecone client with only the required apiKey
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
      // Note: 'environment' parameter is not used in newer Pinecone SDK versions
    });
    
    // Ensure index name exists
    if (!process.env.PINECONE_INDEX) {
      throw new Error('PINECONE_INDEX environment variable is not set');
    }
    
    const index = pinecone.index(process.env.PINECONE_INDEX);
    
    // First try to get index stats to confirm connection is working
    console.log('Fetching index stats...');
    const stats = await index.describeIndexStats();
    console.log('Index stats:', stats);
    
    // Perform simple query
    console.log('Performing test query...');
    const result = await index.query({
      vector: Array(1536).fill(0.1),
      topK: 1,
      includeMetadata: true
    });
    
    console.log('Connection successful! Query result:', JSON.stringify(result, null, 2));
    return { success: true, message: 'Connection established successfully' };
  } catch (error) {
    console.error('Connection test failed:', error);
    
    // Provide more detailed error information and solution suggestions
    if (error.message.includes('apiKey')) {
      console.error('Hint: Make sure you have set PINECONE_API_KEY in your .env file');
    } else if (error.message.includes('index')) {
      console.error('Hint: Make sure your index name is correct and exists in your Pinecone account');
    }
    
    return { success: false, error };
  }
}

// Run the test
testConnection();
