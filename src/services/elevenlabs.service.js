import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class ElevenLabsService {
    constructor() {
        this.apiKey = process.env.ELEVENLABS_API_KEY;
        this.voiceId = process.env.ELEVENLABS_VOICE_ID;
        this.baseURL = 'https://api.elevenlabs.io/v1';
    }

    async textToSpeech(text) {
        try {
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
            console.error('ElevenLabs API Error:', error);
            throw error;
        }
    }

    async streamTextToSpeech(text, onChunk) {
        try {
            const response = await axios({
                method: 'POST',
                url: `${this.baseURL}/text-to-speech/${this.voiceId}/stream`,
                headers: {
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
                responseType: 'stream'
            });

            response.data.on('data', chunk => {
                onChunk(chunk);
            });

            return new Promise((resolve, reject) => {
                response.data.on('end', resolve);
                response.data.on('error', reject);
            });
        } catch (error) {
            console.error('Error in stream:', error);
            throw error;
        }
    }
}

export default new ElevenLabsService();
