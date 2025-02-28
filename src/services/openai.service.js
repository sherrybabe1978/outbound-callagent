import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

class OpenAIService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // Define system message for consistent responses
        this.systemMessage = {
            role: "system",
            content: `You are an AI assistant making outbound calls about an AI newsletter. 
            Key points to remember and include in your responses:
            - The newsletter is delivered every Wednesday morning
            - It's completely free
            - It takes approximately 3 minutes to read
            - Focus on practical AI insights and industry updates
            - Keep responses concise and conversational
            - Always maintain a professional but friendly tone
            - If asked about subscription, emphasize it's free and easy to unsubscribe`
        };
    }

    async generateResponse(userInput, context = []) {
        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    this.systemMessage,
                    ...context,
                    {
                        role: "user",
                        content: userInput
                    }
                ],
                max_tokens: 150,
                temperature: 0.7
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI API Error:', error);
            throw error;
        }
    }
}

export default new OpenAIService();
