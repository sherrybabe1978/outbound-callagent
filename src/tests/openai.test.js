import openaiService from '../services/openai.service.js';
import dotenv from 'dotenv';

dotenv.config();

async function testOpenAIService() {
    console.log('🔍 Testing OpenAI Service...');
    
    const testScenarios = [
        {
            description: "Initial pitch",
            input: "Tell me about your AI newsletter"
        },
        {
            description: "Timing question",
            input: "When do I receive the newsletter?"
        },
        {
            description: "Content question",
            input: "What kind of AI topics do you cover?"
        },
        {
            description: "Subscription concern",
            input: "I already receive too many newsletters"
        },
        {
            description: "Technical question",
            input: "Is this for technical or non-technical people?"
        }
    ];

    try {
        for (const scenario of testScenarios) {
            console.log(`\n📝 Testing scenario: ${scenario.description}`);
            console.log('Input:', scenario.input);
            const response = await openaiService.generateResponse(scenario.input);
            console.log('Response:', response);
            console.log('-------------------');
        }

        // Test conversation flow
        console.log('\n🔄 Testing conversation flow...');
        const conversation = [
            { role: "user", content: "Is the newsletter free?" },
            { role: "assistant", content: "Yes, it's completely free and delivered every Wednesday morning!" }
        ];

        const followUp = "How can I unsubscribe if I don't like it?";
        console.log('Follow-up question:', followUp);
        const contextualResponse = await openaiService.generateResponse(followUp, conversation);
        console.log('Response:', contextualResponse);

    } catch (error) {
        console.error('❌ OpenAI Test Failed:', error.message);
        console.error('Full error:', error);
    }
}

// Run the test
testOpenAIService();
