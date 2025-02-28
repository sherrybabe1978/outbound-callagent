import elevenLabsService from '../services/elevenlabs.service.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function testElevenLabsService() {
    console.log('🔍 Testing ElevenLabs Service...');
    
    try {
        // Test text-to-speech
        console.log('Testing text-to-speech...');
        const testText = "Hello! This is a test of the AI newsletter calling system.";
        const audio = await elevenLabsService.textToSpeech(testText);
        
        // Save test audio file
        const testFile = 'test-output.mp3';
        fs.writeFileSync(testFile, audio);
        console.log(`✅ Audio file saved as ${testFile}`);

        // Test streaming
        console.log('Testing audio streaming...');
        let chunks = [];
        await elevenLabsService.streamTextToSpeech(testText, (chunk) => {
            chunks.push(chunk);
            console.log('Received audio chunk');
        });
        console.log('✅ Streaming test completed');

    } catch (error) {
        console.error('❌ ElevenLabs Test Failed:', error.message);
    }
}

// Run the test
testElevenLabsService();
