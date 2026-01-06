#!/usr/bin/env node
/**
 * Standalone Import Script Runner
 *
 * This wrapper allows running the import script from anywhere without needing
 * to be in the backend directory. It's useful for Docker containers and remote
 * deployments.
 *
 * Usage:
 *   node import-standalone.js --tenant=xxx --user=yyy --import-dir=/path/to/csv
 *
 * Or make executable and run directly:
 *   chmod +x import-standalone.js
 *   ./import-standalone.js --tenant=xxx --user=yyy
 */

const { spawn } = require('child_process');
const path = require('path');

// Get all command line arguments after the script name
const args = process.argv.slice(2);

// Set up the environment
const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'production',
};

console.log('SpecterCRM Standalone Import Runner');
console.log('====================================\n');

// Run the TypeScript import script using ts-node
const scriptPath = path.join(__dirname, 'src', 'scripts', 'run-import.ts');

const child = spawn('npx', ['ts-node', scriptPath, ...args], {
  cwd: __dirname,
  env,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error('Failed to start import script:', error.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
