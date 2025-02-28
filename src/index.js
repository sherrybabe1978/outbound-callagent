import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import twilio from 'twilio';
import elevenLabsService from './services/elevenlabs.service.js';
import path from 'path';
import fs from 'fs';

dotenv.config();

const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Create temp directory for audio files
const audioDir = path.join(process.cwd(), 'temp-audio');
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
}

// Webhook for voice handling
fastify.post('/webhook/voice', async (request, reply) => {
    try {
        const twiml = new twilio.twiml.VoiceResponse();
        
        // Generate initial greeting
        const greeting = "Hi! I'm calling about our weekly AI newsletter that keeps professionals updated with the latest AI trends. Would you be interested in hearing more?";
        
        // Convert to audio using ElevenLabs
        const audioBuffer = await elevenLabsService.textToSpeech(greeting);
        
        // Save audio file
        const fileName = `greeting-${Date.now()}.mp3`;
        const filePath = path.join(audioDir, fileName);
        await fs.promises.writeFile(filePath, audioBuffer);
        
        // Create public URL for the audio file
        const audioUrl = `${process.env.BASE_URL}/audio/${fileName}`;
        
        // Play the audio and gather input
        twiml.play(audioUrl);
        
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
        
        // Convert to audio
        const audioBuffer = await elevenLabsService.textToSpeech(aiResponse);
        
        // Save audio file
        const fileName = `response-${Date.now()}.mp3`;
        const filePath = path.join(audioDir, fileName);
        await fs.promises.writeFile(filePath, audioBuffer);
        
        // Create public URL
        const audioUrl = `${process.env.BASE_URL}/audio/${fileName}`;
        
        // Play response and gather next input
        twiml.play(audioUrl);
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
        await fastify.listen({ 
            port: process.env.PORT || 5050, 
            host: '0.0.0.0' 
        });
        console.log(`Server is running on port ${process.env.PORT || 5050}`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();
