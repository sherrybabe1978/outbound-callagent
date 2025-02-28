import twilioService from './twilio.service.js';
import openaiService from './openai.service.js';
import elevenLabsService from './elevenlabs.service.js';

class CallService {
    constructor() {
        this.activeStreams = new Map();
    }

    async initiateCall(phoneNumber) {
        try {
            const callSid = await twilioService.makeOutboundCall(phoneNumber);
            this.activeStreams.set(callSid, {
                context: [],
                startTime: Date.now()
            });
            return callSid;
        } catch (error) {
            console.error('Error initiating call:', error);
            throw error;
        }
    }

    async handleUserInput(callSid, userInput) {
        try {
            const callData = this.activeStreams.get(callSid);
            if (!callData) {
                throw new Error('Call not found');
            }

            const response = await openaiService.generateResponse(userInput, callData.context);
            const audioStream = await elevenLabsService.textToSpeech(response);

            callData.context.push(
                { role: "user", content: userInput },
                { role: "assistant", content: response }
            );

            return audioStream;
        } catch (error) {
            console.error('Error handling user input:', error);
            throw error;
        }
    }
}

export default new CallService();
