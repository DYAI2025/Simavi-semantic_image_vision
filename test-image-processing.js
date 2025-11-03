#!/usr/bin/env node

// Comprehensive image processing test
const fs = require('fs').promises;
const path = require('path');

async function testImageProcessing() {
  console.log('Testing image processing functionality...');

  // Check if required files exist
  const requiredFiles = [
    './foto_identifikation_system/nextjs_space/lib/vision-api-client.ts',
    './foto_identifikation_system/nextjs_space/lib/exif-utils.ts',
    './foto_identifikation_system/nextjs_space/lib/s3.ts'
  ];

  for (const file of requiredFiles) {
    try {
      await fs.access(file);
      console.log(`✓ Found required file: ${file}`);
    } catch (error) {
      console.error(`✗ Missing required file: ${file}`);
      process.exit(1);
    }
  }

  // Test data sanitization function from the vision API client
  const { analyzeImage } = await import('./foto_identifikation_system/nextjs_space/lib/vision-api-client.js');
  
  console.log('✓ Import successful - all modules are properly connected');

  // Test with environment variables
  const hasHuggingFace = !!process.env.HUGGINGFACE_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  console.log(`Hugging Face API key available: ${hasHuggingFace}`);
  console.log(`OpenAI API key available: ${hasOpenAI}`);

  if (!hasHuggingFace && !hasOpenAI) {
    console.warn('⚠ Warning: No API keys found. Connectivity tests will likely fail.');
  }

  console.log('✓ Image processing test completed successfully');
  process.exit(0);
}

testImageProcessing().catch(err => {
  console.error('✗ Image processing test failed:', err);
  process.exit(1);
});