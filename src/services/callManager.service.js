import twilioService from './twilio.service.js';
import openaiService from './openai.service.js';
import elevenLabsService from './elevenlabs.service.js';

class CallManagerService {
    constructor() {
        this.activeStreams = new Map();
    }

    async initiateCall(phoneNumber) {
        try {
            console.log(`Initiating call to ${phoneNumber}`);
            
            const callSid = await twilioService.makeOutboundCall(phoneNumber);
            
            this.activeStreams.set(callSid, {
                startTime: Date.now(),
                context: [
                    {
                        role: "system",
                        content: "You are an AI assistant making calls about a weekly AI newsletter. Keep responses concise and engaging. The newsletter is delivered every Wednesday morning and is free."
                    }
                ],
                emailCollected: false
            });

            return callSid;
        } catch (error) {
            console.error('Error initiating call:', error);
            throw error;
        }
    }

    async getInitialGreeting(callSid) {
        try {
            const greeting = "Hi! I'm calling about our weekly AI newsletter that keeps professionals updated with the latest AI trends. Would you be interested in hearing more?";
            
            // Convert greeting to speech using ElevenLabs
            const audioStream = await elevenLabsService.textToSpeech(greeting);
            
            // Initialize call context
            this.activeStreams.set(callSid, {
                startTime: Date.now(),
                context: [
                    {
                        role: "system",
                        content: "You are an AI assistant making calls about a weekly AI newsletter. Keep responses concise and engaging. The newsletter is delivered every Wednesday morning and is free."
                    },
                    {
                        role: "assistant",
                        content: greeting
                    }
                ],
                emailCollected: false
            });

            return {
                audio: audioStream,
                text: greeting
            };
        } catch (error) {
            console.error('Error generating initial greeting:', error);
            throw error;
        }
    }

    async handleConversation(callSid, userInput) {
        try {
            const callData = this.activeStreams.get(callSid);
            if (!callData) {
                throw new Error('Call not found');
            }

            // Generate AI response
            const aiResponse = await openaiService.generateResponse(
                userInput, 
                callData.context
            );

            // Convert to speech
            const audioStream = await elevenLabsService.textToSpeech(aiResponse);

            // Update conversation context
            callData.context.push(
                { role: "user", content: userInput },
                { role: "assistant", content: aiResponse }
            );

            return {
                audio: audioStream,
                text: aiResponse
            };
        } catch (error) {
            console.error('Error in conversation:', error);
            throw error;
        }
    }

    async processAudioInput(audioBuffer) {
        // Implement audio processing here
        // For now, return a placeholder
        return "Hello, tell me about the newsletter";
    }
}

export default new CallManagerService();
