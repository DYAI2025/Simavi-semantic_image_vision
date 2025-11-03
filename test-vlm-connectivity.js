#!/usr/bin/env node

// Simple VLM connectivity test
const { analyzeImage } = require('./foto_identifikation_system/nextjs_space/lib/vision-api-client');

async function testVLMConnectivity() {
  console.log('Testing VLM connectivity...');

  // Test with a placeholder base64 image (1x1 pixel PNG)
  const placeholderImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  
  try {
    console.log('Attempting to analyze image with Hugging Face/OpenAI...');
    const result = await analyzeImage(placeholderImage, 'test.jpg', null);
    console.log('Success! Analysis result:', result);
    console.log('✓ VLM connectivity test passed');
    process.exit(0);
  } catch (error) {
    console.error('✗ VLM connectivity test failed:', error.message);
    process.exit(1);
  }
}

testVLMConnectivity();