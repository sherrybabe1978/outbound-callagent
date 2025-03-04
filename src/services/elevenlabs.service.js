import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class ElevenLabsService {
    constructor() {
        this.apiKey = process.env.ELEVENLABS_API_KEY;
        this.voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Default to a known voice if not set
        this.baseURL = 'https://api.elevenlabs.io/v1';
        this.availableVoices = [];
    }

    async initialize() {
        try {
            // Get available voices first
            await this.getVoices();
            
            // Verify the voice ID exists, use default if not
            if (!this.verifyVoiceExists(this.voiceId)) {
                console.warn(`Voice ID ${this.voiceId} not found. Using the first available voice.`);
                this.voiceId = this.availableVoices[0]?.voice_id;
                
                if (!this.voiceId) {
                    throw new Error('No voices available in your ElevenLabs account');
                }
            }
            
            console.log(`Using ElevenLabs voice: ${this.voiceId}`);
            return true;
        } catch (error) {
            console.error('Error initializing ElevenLabs service:', error.message);
            return false;
        }
    }

    async getVoices() {
        try {
            const response = await axios({
                method: 'GET',
                url: `${this.baseURL}/voices`,
                headers: {
                    'xi-api-key': this.apiKey,
                    'Content-Type': 'application/json'
                }
            });
            
            this.availableVoices = response.data.voices || [];
            console.log(`Found ${this.availableVoices.length} voices in your ElevenLabs account`);
            
            if (this.availableVoices.length > 0) {
                console.log('Available voices:');
                this.availableVoices.forEach(voice => {
                    console.log(`- ${voice.name} (ID: ${voice.voice_id})`);
                });
            }
            
            return this.availableVoices;
        } catch (error) {
            console.error('Error fetching voices:', error.message);
            return [];
        }
    }

    verifyVoiceExists(voiceId) {
        return this.availableVoices.some(voice => voice.voice_id === voiceId);
    }

    async textToSpeech(text) {
        try {
            if (!text || text.trim() === '') {
                console.warn('Empty text provided to text-to-speech');
                return null;
            }

            console.log(`Converting to speech: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`);
            
            const response = await axios({
                method: 'POST',
                url: `${this.baseURL}/text-to-speech/${this.voiceId}`,
                headers: {
                    'Accept': 'audio/mpeg',
                    'xi-api-key': this.apiKey,
                    'Content-Type': 'application/json'
                },
                data: {
                    text: text,
                    model_id: 'eleven_monolingual_v1',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.5
                    }
                },
                responseType: 'arraybuffer'
            });

            return response.data;
        } catch (error) {
            console.error('ElevenLabs API Error:', error.message);
            if (error.response) {
                // Try to parse the error message from the buffer
                try {
                    const errorJson = JSON.parse(Buffer.from(error.response.data).toString());
                    console.error('ElevenLabs API Error Details:', errorJson);
                } catch (e) {
                    console.error('Raw error data:', error.response.data);
                }
            }
            return null;
        }
    }
}

export default new ElevenLabsService();