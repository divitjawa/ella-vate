// env-trace.js
// This script will trace what happens to the environment variables

// First, log the raw environment before any module loading
console.log('=== ENVIRONMENT BEFORE ANY MODULES ===');
console.log('PINECONE_API_KEY:', process.env.PINECONE_API_KEY || 'not set');
console.log('PINECONE_INDEX:', process.env.PINECONE_INDEX || 'not set');
console.log('PINECONE_ENVIRONMENT:', process.env.PINECONE_ENVIRONMENT || 'not set');

// Now, monkey-patch process.env to detect changes
const originalEnv = { ...process.env };
const propertiesToWatch = ['PINECONE_API_KEY', 'PINECONE_INDEX', 'PINECONE_ENVIRONMENT'];

// Create a proxy to monitor changes to process.env
process.env = new Proxy(process.env, {
  set(target, prop, value) {
    if (propertiesToWatch.includes(prop)) {
      console.log(`\n=== CHANGE DETECTED ===`);
      console.log(`Property: ${prop}`);
      console.log(`Old value: ${target[prop]}`);
      console.log(`New value: ${value}`);
      console.log(`Stack trace:`);
      console.trace();
    }
    target[prop] = value;
    return true;
  }
});

// Load dotenv and watch what happens
console.log('\n=== LOADING DOTENV ===');
require('dotenv').config();

console.log('\n=== ENVIRONMENT AFTER DOTENV ===');
console.log('PINECONE_API_KEY:', process.env.PINECONE_API_KEY || 'not set');
console.log('PINECONE_INDEX:', process.env.PINECONE_INDEX || 'not set');
console.log('PINECONE_ENVIRONMENT:', process.env.PINECONE_ENVIRONMENT || 'not set');

// Now try to load other common configuration modules to see if they override anything
console.log('\n=== ATTEMPTING TO LOAD OTHER MODULES ===');

// Try to load various common configuration packages
const modulesToTry = [
  '@pinecone-database/pinecone',
  'config',
  'env-var',
  'dotenv-defaults',
  'dotenv-extended',
  'dotenv-flow',
  'dotenv-safe'
];

for (const moduleName of modulesToTry) {
  try {
    console.log(`Trying to load: ${moduleName}`);
    require(moduleName);
    console.log(`Successfully loaded: ${moduleName}`);
  } catch (error) {
    console.log(`Module not available: ${moduleName}`);
  }
}

console.log('\n=== FINAL ENVIRONMENT ===');
console.log('PINECONE_API_KEY:', process.env.PINECONE_API_KEY || 'not set');
console.log('PINECONE_INDEX:', process.env.PINECONE_INDEX || 'not set');
console.log('PINECONE_ENVIRONMENT:', process.env.PINECONE_ENVIRONMENT || 'not set');

// If we get here and still don't see changes, try to analyze your node_modules
console.log('\n=== CHECKING FOR SUSPICIOUS MODULES ===');
const fs = require('fs');
const path = require('path');

const nodeModulesPath = path.join(process.cwd(), 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  try {
    // List top-level modules
    const modules = fs.readdirSync(nodeModulesPath);
    console.log(`Found ${modules.length} top-level modules`);
    
    // Look for suspicious module names
    const suspiciousModules = modules.filter(module => 
      module.includes('env') || 
      module.includes('config') || 
      module.includes('pinecone')
    );
    
    if (suspiciousModules.length > 0) {
      console.log('Potentially relevant modules:');
      suspiciousModules.forEach(module => console.log(`- ${module}`));
    }
  } catch (error) {
    console.error('Error scanning node_modules:', error);
  }
}
