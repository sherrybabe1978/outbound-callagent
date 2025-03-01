// src/index.js - fixed with correct modalities

import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import twilio from 'twilio';
import readline from 'readline';
import twilioService from './services/twilio.service.js';

dotenv.config();

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Constants
const PORT = process.env.PORT || 5050;

// Create readline interface
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

// Store recipient info
let recipientName = '';
let recipientPhone = '';

// Webhook for handling the voice call
fastify.post('/webhook/voice', async (request, reply) => {
    console.log('📞 Call webhook received');
    const twiml = new twilio.twiml.VoiceResponse();
    
    // Connect to our WebSocket for real-time conversation
    twiml.connect().stream({
        url: `wss://${request.headers.host}/media-stream`
    });
    
    reply.type('text/xml').send(twiml.toString());
});

// WebSocket route for media streaming
fastify.register(async (fastify) => {
    fastify.get('/media-stream', { websocket: true }, (connection, req) => {
        console.log('📱 Twilio WebSocket connected');
        
        // Connect to OpenAI Realtime API
        const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17', {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'OpenAI-Beta': 'realtime=v1'
            }
        });
        
        let streamSid = null;
        
        // OpenAI WebSocket handlers
        openAiWs.on('open', () => {
            console.log('✅ Connected to OpenAI Realtime API');
            
            setTimeout(() => {
                // Use minimal configuration with all required fields
                const sessionConfig = {
                    type: 'session.update',
                    session: {
                        input_audio_format: 'g711_ulaw',
                        output_audio_format: 'g711_ulaw',
                        voice: 'alloy',
                        instructions: `You are an AI assistant calling ${recipientName} about a weekly AI newsletter. Start by saying "Hello ${recipientName}! I'm calling about our weekly AI newsletter that keeps professionals updated with the latest AI trends. Would you be interested in hearing more?"`,
                        modalities: ["audio", "text"]  // Set both modalities in session config
                    }
                };
                
                console.log('Sending session configuration...');
                openAiWs.send(JSON.stringify(sessionConfig));
            }, 1000);
        });
        
        openAiWs.on('message', (data) => {
            try {
                const event = JSON.parse(data);
                console.log(`📥 OpenAI event: ${event.type}`);
                
                if (event.type === 'error') {
                    console.error('❌ OpenAI error details:', JSON.stringify(event, null, 2));
                }
                
                if (event.type === 'session.updated') {
                    console.log('✅ Session configured successfully');
                    
                    // Create initial response with both audio and text modalities
                    setTimeout(() => {
                        console.log('🎤 Requesting initial greeting...');
                        const createResponse = {
                            type: 'response.create',
                            response: {
                                modalities: ["audio", "text"]  // FIXED: Include both audio and text
                            }
                        };
                        openAiWs.send(JSON.stringify(createResponse));
                    }, 1000);
                }
                
                // Forward audio from OpenAI to Twilio
                if (event.type === 'response.audio.delta' && event.delta) {
                    const audioDelta = {
                        event: 'media',
                        streamSid: streamSid,
                        media: { payload: Buffer.from(event.delta, 'base64').toString('base64') }
                    };
                    connection.send(JSON.stringify(audioDelta));
                }
                
                // Log any text responses for debugging
                if (event.type === 'response.text.delta' && event.delta) {
                    process.stdout.write(event.delta);
                }
            } catch (error) {
                console.error('❌ Error processing OpenAI message:', error);
            }
        });
        
        openAiWs.on('error', (error) => {
            console.error('❌ OpenAI WebSocket error:', error.message);
        });
        
        openAiWs.on('close', (code, reason) => {
            console.error(`❌ OpenAI WebSocket closed: Code ${code}. Reason: ${reason || 'No reason provided'}`);
        });
        
        // Handle messages from Twilio
        connection.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                
                switch (data.event) {
                    case 'media':
                        // Forward audio to OpenAI
                        if (openAiWs.readyState === WebSocket.OPEN) {
                            const audioAppend = {
                                type: 'input_audio_buffer.append',
                                audio: data.media.payload
                            };
                            openAiWs.send(JSON.stringify(audioAppend));
                        }
                        break;
                        
                    case 'start':
                        streamSid = data.start.streamSid;
                        console.log(`✅ Call stream started: ${streamSid}`);
                        break;
                }
            } catch (error) {
                console.error('❌ Error processing Twilio message:', error);
            }
        });
        
        // Handle Twilio disconnection
        connection.on('close', () => {
            console.log('📞 Twilio connection closed');
            if (openAiWs.readyState === WebSocket.OPEN) {
                openAiWs.close();
            }
        });
    });
});

// Webhook for call status updates
fastify.post('/webhook/status', async (request, reply) => {
    const { CallSid, CallStatus } = request.body;
    console.log(`📞 Call ${CallSid} status: ${CallStatus}`);
    reply.send({ received: true });
});

// Start server and initiate call flow
const start = async () => {
    try {
        // Start the server
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`✅ Server running on port ${PORT}`);
        
        // Get call details from console
        console.log("\n📞 OUTBOUND CALL SYSTEM 📞");
        console.log("---------------------------");
        
        recipientName = await getUserInput("Enter recipient's name: ");
        recipientPhone = await getUserInput("Enter recipient's phone number (with country code, e.g. +1234567890): ");
        
        console.log(`\nPreparing to call ${recipientName} at ${recipientPhone}...`);
        
        // Make the outbound call
        await twilioService.makeOutboundCall(recipientPhone);
        
        console.log('\nCall initiated. Press Ctrl+C to exit when finished.\n');
        
    } catch (err) {
        console.error('❌ Startup error:', err);
        rl.close();
        process.exit(1);
    }
};

// Start the application
start();