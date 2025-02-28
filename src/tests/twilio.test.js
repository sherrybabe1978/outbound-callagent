import twilioService from '../services/twilio.service.js';
import dotenv from 'dotenv';

dotenv.config();

async function testTwilioService() {
    console.log('🔍 Testing Twilio Service...');
    
    try {
        // Test Twilio credentials
        console.log('Testing Twilio credentials...');
        
        // Log environment variables (without sensitive data)
        console.log('BASE_URL:', process.env.BASE_URL);
        console.log('TWILIO_PHONE_NUMBER:', process.env.TWILIO_PHONE_NUMBER);
        
        const testNumber = '+18447440896'; // Replace with your test number
        
        // Test making a call
        console.log('Testing outbound call...');
        const callSid = await twilioService.makeOutboundCall(testNumber);
        console.log('✅ Call initiated successfully!', callSid);
        
    } catch (error) {
        console.error('❌ Twilio Test Failed:', error.message);
        console.error('Full error:', error);
    }
}

// Run the test
testTwilioService();

