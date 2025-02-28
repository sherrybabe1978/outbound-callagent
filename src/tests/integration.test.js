// src/tests/integration.test.js
import callManagerService from '../services/callManager.service.js';
import dotenv from 'dotenv';

dotenv.config();

async function testIntegration() {
    console.log('🔍 Testing Integrated Call System...');
    
    try {
        // Replace with your test phone number
        const testNumber = '+19165478196';
        
        console.log(`Initiating test call to ${testNumber}`);
        const callSid = await callManagerService.initiateCall(testNumber);
        console.log('✅ Call initiated:', callSid);

        // Simulate conversation
        const testInput = "Hi, tell me about the newsletter";
        console.log('\nSimulating user input:', testInput);
        
        const response = await callManagerService.handleConversation(callSid, testInput);
        console.log('✅ AI Response:', response.text);
        console.log('✅ Audio generated successfully');

    } catch (error) {
        console.error('❌ Integration Test Failed:', error.message);
        console.error('Full error:', error);
    }
}

// Run the test
testIntegration();
