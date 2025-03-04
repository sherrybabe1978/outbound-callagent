import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import twilio from 'twilio';
import elevenLabsService from './services/elevenlabs.service.js';
import twilioService from './services/twilio.service.js';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

dotenv.config();

const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Create temp directory for audio files
const audioDir = path.join(process.cwd(), 'temp-audio');
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
}

// Store call details
let personalizedGreeting = '';
let greetingFileName = '';

// Create readline interface for console input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to get user input
function getUserInput(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            resolve(answer);
        });
    });
}

// Function to create a fallback greeting audio using TwiML text-to-speech
async function createFallbackGreeting(twiml, greeting) {
    console.log('Using TwiML fallback for greeting audio');
    twiml.say({
        voice: 'Polly.Matthew',
        language: 'en-US'
    }, greeting);
}

// Webhook for voice handling
fastify.post('/webhook/voice', async (request, reply) => {
    try {
        const twiml = new twilio.twiml.VoiceResponse();
        
        if (fs.existsSync(path.join(audioDir, greetingFileName))) {
            // Play the pre-generated personalized greeting
            const audioUrl = `${process.env.BASE_URL}/audio/${greetingFileName}`;
            twiml.play(audioUrl);
        } else {
            // Use TwiML fallback if audio file doesn't exist
            createFallbackGreeting(twiml, personalizedGreeting);
        }
        
        // Add gather for user response
        twiml.gather({
            input: 'speech',
            action: '/handle-response',
            method: 'POST',
            speechTimeout: 'auto',
            language: 'en-US'
        });

        reply.type('text/xml').send(twiml.toString());
    } catch (error) {
        console.error('Webhook error:', error);
        reply.status(500).send('Error processing call');
    }
});

// Handle user response
fastify.post('/handle-response', async (request, reply) => {
    const twiml = new twilio.twiml.VoiceResponse();
    try {
        const userSpeech = request.body.SpeechResult;
        
        // Generate AI response
        const aiResponse = "That's great! Our newsletter delivers the latest AI insights every Wednesday morning, and it's completely free. Would you like to receive it?";
        
        let audioUrl = null;
        
        // Try to convert to audio
        const audioBuffer = await elevenLabsService.textToSpeech(aiResponse);
        
        if (audioBuffer) {
            // Save audio file
            const fileName = `response-${Date.now()}.mp3`;
            const filePath = path.join(audioDir, fileName);
            await fs.promises.writeFile(filePath, audioBuffer);
            
            // Create public URL
            audioUrl = `${process.env.BASE_URL}/audio/${fileName}`;
            twiml.play(audioUrl);
        } else {
            // Fallback to TwiML
            twiml.say({
                voice: 'Polly.Matthew',
                language: 'en-US'
            }, aiResponse);
        }
        
        // Gather next input
        twiml.gather({
            input: 'speech',
            action: '/handle-response',
            method: 'POST',
            speechTimeout: 'auto',
            language: 'en-US'
        });
        
    } catch (error) {
        console.error('Response handling error:', error);
        twiml.say('I apologize, but I encountered an error. Please try again later.');
    }
    
    reply.type('text/xml').send(twiml.toString());
});

// Serve audio files
fastify.get('/audio/:filename', async (request, reply) => {
    const filePath = path.join(audioDir, request.params.filename);
    return reply.type('audio/mpeg').send(fs.createReadStream(filePath));
});

// Start server
const start = async () => {
    try {
        // Initialize the ElevenLabs service first
        const elevenLabsInitialized = await elevenLabsService.initialize();
        
        // Get recipient information
        console.log("\n📞 OUTBOUND CALL SYSTEM 📞");
        console.log("---------------------------");
        
        const recipientName = await getUserInput("Enter recipient's name: ");
        const phoneNumber = await getUserInput("Enter recipient's phone number (with country code, e.g. +1234567890): ");
        
        // Generate personalized greeting
        personalizedGreeting = `Hello ${recipientName}! I'm calling about our weekly AI newsletter that keeps professionals updated with the latest AI trends. Would you be interested in hearing more?`;
        console.log(`\nCreating personalized greeting: "${personalizedGreeting}"`);
        
        // Only try to generate audio if ElevenLabs is properly initialized
        if (elevenLabsInitialized) {
            try {
                // Generate audio for the greeting
                const audioBuffer = await elevenLabsService.textToSpeech(personalizedGreeting);
                
                if (audioBuffer) {
                    // Save audio file
                    greetingFileName = `greeting-${Date.now()}.mp3`;
                    const filePath = path.join(audioDir, greetingFileName);
                    await fs.promises.writeFile(filePath, audioBuffer);
                    console.log('✅ Personalized greeting audio created successfully!');
                } else {
                    console.warn('⚠️ Could not generate ElevenLabs audio. Will use TwiML fallback.');
                }
            } catch (error) {
                console.error('Error creating greeting audio:', error.message);
                console.log('Will use TwiML fallback for greeting.');
            }
        } else {
            console.warn('⚠️ ElevenLabs service not initialized. Will use TwiML fallback.');
        }
        
        // Start server to handle Twilio callbacks
        await fastify.listen({ 
            port: process.env.PORT || 5050, 
            host: '0.0.0.0' 
        });
        console.log(`Server is running on port ${process.env.PORT || 5050}`);
        
        // Make the outbound call
        console.log(`\nMaking call to ${phoneNumber}...`);
        const callSid = await twilioService.makeOutboundCall(phoneNumber);
        console.log(`✅ Call initiated successfully! Call SID: ${callSid}`);
        
    } catch (err) {
        console.error('❌ Error:', err.message);
        rl.close();
        process.exit(1);
    }
};

start();