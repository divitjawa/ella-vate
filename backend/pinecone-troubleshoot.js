require('dotenv').config();

function checkEnvVariables() {
  console.log('Checking environment variables:');
  
  // Check API key (safely - only show first and last 4 characters)
  const apiKey = process.env.PINECONE_API_KEY || '';
  if (apiKey) {
    const firstFour = apiKey.substring(0, 4);
    const lastFour = apiKey.length > 4 ? apiKey.substring(apiKey.length - 4) : '';
    const middle = apiKey.length > 8 ? '*'.repeat(apiKey.length - 8) : '';
    console.log(`PINECONE_API_KEY: ${firstFour}${middle}${lastFour} (${apiKey.length} characters)`);
  } else {
    console.log('PINECONE_API_KEY: Not set');
  }
  
  // Check index name
  console.log(`PINECONE_INDEX: ${process.env.PINECONE_INDEX || 'Not set'}`);
  
  // Check if any environment variable exists (deprecated, but checking in case)
  console.log(`PINECONE_ENVIRONMENT: ${process.env.PINECONE_ENVIRONMENT || 'Not set'}`);
  
  // Print all environment variables starting with PINECONE_
  console.log('\nAll Pinecone-related environment variables:');
  Object.keys(process.env)
    .filter(key => key.startsWith('PINECONE_'))
    .forEach(key => {
      const value = process.env[key];
      if (key === 'PINECONE_API_KEY') {
        // Already printed above with masking
        return;
      }
      console.log(`${key}: ${value}`);
    });
}

checkEnvVariables();