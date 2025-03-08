// src/index.js
import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import twilio from 'twilio';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import path from 'path';
import csvService from './services/csv.service.js';
import twilioService from './services/twilio.service.js';

dotenv.config();

const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

const PORT = process.env.PORT || 5050;
const CALL_INTERVAL = 120000; // 2 minute
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Direct CSV functions as backup for critical operations
const CSV_PATH = path.join(process.cwd(), 'contacts.csv');
function directSaveEmailToCSV(phoneNumber, email) {
    try {
        console.log(`⚡ Direct CSV save attempt for ${phoneNumber}: ${email}`);
        
        // Read the file directly
        const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true
        });
        
        // Update the record directly
        let updated = false;
        const updatedRecords = records.map(record => {
            if (record['Phone Number'] === phoneNumber) {
                updated = true;
                return {
                    ...record,
                    'Email': email,
                    'Status': 'Email Collected'
                };
            }
            return record;
        });
        
        if (!updated) {
            console.error(`❌ Direct save: No contact found with phone number ${phoneNumber}`);
            return false;
        }
        
        // Write back directly
        const headers = ['Name', 'Phone Number', 'Email', 'Status'];
        const output = stringify(updatedRecords, {
            header: true,
            columns: headers
        });
        
        fs.writeFileSync(CSV_PATH, output);
        console.log(`⚡ Direct save: Email saved successfully for ${phoneNumber}`);
        
        // Verify write
        const newContent = fs.readFileSync(CSV_PATH, 'utf-8');
        const newRecords = parse(newContent, {
            columns: true,
            skip_empty_lines: true
        });
        
        const verifiedRecord = newRecords.find(r => r['Phone Number'] === phoneNumber);
        if (verifiedRecord && verifiedRecord.Email === email) {
            console.log(`✅ Direct save: Verification successful for ${phoneNumber}`);
            return true;
        } else {
            console.error(`❌ Direct save: Verification failed for ${phoneNumber}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Direct CSV save error:', error);
        return false;
    }
}

function createEmailCollectionTool() {
    return {
        type: "function",
        name: "collect_email",
        description: "Collect and verify an email address from the user.",
        parameters: {
            type: "object",
            properties: {
                email: {
                    type: "string",
                    description: "The email address provided by the user."
                },
                confirmed: {
                    type: "boolean",
                    description: "Whether the user confirmed the email address is correct."
                }
            },
            required: ["email", "confirmed"]
        }
    };
}

// Store active calls
const activeCallsMap = new Map();

async function processCallQueue() {
    try {
        const contacts = await csvService.readContacts();
        let index = 0;

        console.log(`📋 Loaded ${contacts.length} contacts from CSV`);

        const makeNextCall = async () => {
            if (index >= contacts.length) {
                console.log('✅ All contacts processed');
                return;
            }

            const contact = contacts[index];
            console.log(`\n📞 Calling ${contact.Name} at ${contact['Phone Number']} (${index + 1}/${contacts.length})`);

            try {
                const callSid = await twilioService.makeOutboundCall(contact['Phone Number']);
                activeCallsMap.set(callSid, {
                    name: contact.Name,
                    phoneNumber: contact['Phone Number'],
                    startTime: new Date()
                });

                await csvService.updateContact(contact['Phone Number'], {
                    Status: 'Call Initiated'
                });

                console.log(`Call initiated to ${contact.Name} with SID: ${callSid}`);
                
                index++;
                setTimeout(makeNextCall, CALL_INTERVAL);
            } catch (error) {
                console.error(`❌ Error calling ${contact.Name}:`, error);
                await csvService.updateContact(contact['Phone Number'], {
                    Status: 'Call Failed'
                });
                index++;
                setTimeout(makeNextCall, CALL_INTERVAL);
            }
        };

        await makeNextCall();
    } catch (error) {
        console.error('❌ Error processing call queue:', error);
    }
}

fastify.post('/webhook/voice', async (request, reply) => {
    console.log('📞 Call webhook received');
    const { CallSid } = request.body;
    const callData = activeCallsMap.get(CallSid);
    
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.connect().stream({
        url: `wss://${request.headers.host}/media-stream`
    });
    
    reply.type('text/xml').send(twiml.toString());
});

fastify.register(async (fastify) => {
    fastify.get('/media-stream', { websocket: true }, (connection, req) => {
        console.log('📱 Twilio WebSocket connected');
        
        const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17', {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'OpenAI-Beta': 'realtime=v1'
            }
        });
        
        let streamSid = null;
        let callSid = null;
        let currentCallData = null;
        let emailCollected = false;
        
        openAiWs.on('open', () => {
            console.log('✅ Connected to OpenAI Realtime API');
            
            // Configure session immediately
            setTimeout(() => {
                const sessionConfig = {
                    type: 'session.update',
                    session: {
                        input_audio_format: 'g711_ulaw',
                        output_audio_format: 'g711_ulaw',
                        voice: 'alloy',
                        instructions: `You are an AI assistant calling about a weekly AI newsletter.

                        Your conversation flow should be:
                        1. Start with: "Hello, is this [name]?" where [name] is the person you're calling
                        2. Wait for confirmation
                        3. Introduce yourself and the newsletter
                        4. Ask if they're interested in the weekly AI newsletter
                        5. If they show interest, ask for their email address
                        6. Repeat the email back to confirm, then use the collect_email function
                        7. After collecting the email, say "Thank you [name]! You're all set. Your first newsletter will arrive next Wednesday. Have a great day!" and end the call
                        8. If they're not interested, say "No problem, [name]. Thank you for your time. Have a great day!" and end the call
                        
                        When you receive an email address:
                        1. Repeat it back to them to confirm
                        2. Once confirmed, use the collect_email function with confirmed=true
                        3. After collecting the email, thank them by name and say goodbye
                        
                        Keep responses concise and professional. The newsletter is free and delivered every Wednesday morning.`,
                        tools: [createEmailCollectionTool()],
                        tool_choice: "auto",
                        modalities: ["audio", "text"]
                    }
                };
                
                console.log('Sending session configuration...');
                openAiWs.send(JSON.stringify(sessionConfig));
            }, 1000);
        });
        
        // Function to end the call
        const endCall = async () => {
            try {
                console.log(`🔚 Attempting to end call with SID: ${callSid}`);
                
                if (callSid) {
                    await twilioClient.calls(callSid)
                        .update({status: 'completed'})
                        .then(() => console.log('📞 Call successfully ended'))
                        .catch(err => console.error('❌ Error ending call:', err));
                } else if (streamSid) {
                    console.log(`🔍 No CallSid found. Using StreamSid: ${streamSid}`);
                    // Try finding a call using the streamSid
                    const calls = await twilioClient.calls.list({limit: 20});
                    const matchingCall = calls.find(call => 
                        call.sid === streamSid || 
                        call.sid.includes(streamSid.substring(0, 10))
                    );
                    
                    if (matchingCall) {
                        console.log(`📞 Found matching call: ${matchingCall.sid}`);
                        await twilioClient.calls(matchingCall.sid)
                            .update({status: 'completed'})
                            .then(() => console.log('📞 Call successfully ended'))
                            .catch(err => console.error('❌ Error ending call:', err));
                    } else {
                        console.error('❌ No matching call found to end');
                    }
                }
                
                // Ensure the websocket is closed
                if (openAiWs.readyState === WebSocket.OPEN) {
                    openAiWs.close();
                }
            } catch (error) {
                console.error('❌ Error in endCall function:', error);
            }
        };
        
        openAiWs.on('message', async (data) => {
            try {
                const event = JSON.parse(data);
                
                if (event.type === 'session.updated') {
                    console.log('✅ Session configured successfully');
                    
                    setTimeout(() => {
                        console.log('🎤 Requesting initial greeting...');
                        
                        // Create the initial greeting, passing the name if available
                        const createResponse = {
                            type: 'response.create',
                            response: {
                                modalities: ["audio", "text"]
                            }
                        };
                        
                        if (currentCallData && currentCallData.name) {
                            createResponse.response.instructions = `Start the call by saying: "Hello, is this ${currentCallData.name}?"`; 
                        }
                        
                        openAiWs.send(JSON.stringify(createResponse));
                    }, 1000);
                }

                if (event.type === 'response.done') {
                    const output = event.response.output && event.response.output[0];
                    
                    if (output && output.type === 'function_call') {
                        if (output.name === 'collect_email') {
                            try {
                                const args = JSON.parse(output.arguments);
                                
                                if (args.confirmed && args.email) {
                                    console.log(`✉️ Email confirmed and collected: ${args.email}`);
                                    
                                    if (currentCallData) {
                                        // Try both service and direct update methods
                                        console.log('📝 Attempting to save email via service...');
                                        let emailSaved = false;
                                        
                                        try {
                                            // First try service method
                                            await csvService.updateContact(currentCallData.phoneNumber, {
                                                Email: args.email,
                                                Status: 'Email Collected'
                                            });
                                            
                                            // Verify via service
                                            const contacts = await csvService.readContacts();
                                            const updatedContact = contacts.find(c => c['Phone Number'] === currentCallData.phoneNumber);
                                            
                                            if (updatedContact && updatedContact.Email === args.email) {
                                                console.log('✅ Email saved via service method');
                                                emailSaved = true;
                                            } else {
                                                console.log('⚠️ Service verification failed, trying direct method...');
                                                emailSaved = directSaveEmailToCSV(currentCallData.phoneNumber, args.email);
                                            }
                                        } catch (error) {
                                            console.error('❌ Service save method failed:', error);
                                            console.log('⚠️ Falling back to direct method...');
                                            emailSaved = directSaveEmailToCSV(currentCallData.phoneNumber, args.email);
                                        }
                                        
                                        if (emailSaved) {
                                            console.log('✅ Email successfully saved to CSV!');
                                            emailCollected = true;
                                            
                                            // Send success response back to OpenAI
                                            const functionResponse = {
                                                type: 'conversation.item.create',
                                                item: {
                                                    type: 'function_call_output',
                                                    call_id: output.call_id,
                                                    output: JSON.stringify({
                                                        success: true,
                                                        message: "Email collected and saved successfully"
                                                    })
                                                }
                                            };
                                            
                                            openAiWs.send(JSON.stringify(functionResponse));
                                            
                                            // Request final goodbye with name
                                            const createResponse = {
                                                type: 'response.create',
                                                response: {
                                                    modalities: ["audio", "text"],
                                                    instructions: currentCallData.name 
                                                        ? `Thank ${currentCallData.name} by name for their email, tell them their first newsletter will arrive next Wednesday, and say goodbye.`
                                                        : `Thank the user for their email, tell them their first newsletter will arrive next Wednesday, and say goodbye.`
                                                }
                                            };
                                            openAiWs.send(JSON.stringify(createResponse));
                                            
                                            // End call after delay
                                            console.log('⏰ Setting timeout to end call in 7 seconds...');
                                            setTimeout(endCall, 7000);
                                        } else {
                                            console.error('❌ Failed to save email to CSV after all attempts');
                                            
                                            // Send error response
                                            const functionResponse = {
                                                type: 'conversation.item.create',
                                                item: {
                                                    type: 'function_call_output',
                                                    call_id: output.call_id,
                                                    output: JSON.stringify({
                                                        success: false,
                                                        message: "Failed to save email"
                                                    })
                                                }
                                            };
                                            
                                            openAiWs.send(JSON.stringify(functionResponse));
                                        }
                                    }
                                }
                            } catch (error) {
                                console.error('❌ Error processing email collection:', error);
                            }
                        }
                    }
                }
                
                if (event.type === 'response.audio.delta' && event.delta) {
                    const audioDelta = {
                        event: 'media',
                        streamSid: streamSid,
                        media: { payload: Buffer.from(event.delta, 'base64').toString('base64') }
                    };
                    connection.send(JSON.stringify(audioDelta));
                }
                
                if (event.type === 'response.text.delta' && event.delta) {
                    process.stdout.write(event.delta);
                    
                    // Check for goodbye phrases to trigger call end
                    const goodbyePhrases = [
                        "have a great day",
                        "goodbye",
                        "thank you for your time",
                        "you're all set",
                        "first newsletter will arrive"
                    ];
                    
                    if (emailCollected && goodbyePhrases.some(phrase => event.delta.toLowerCase().includes(phrase))) {
                        console.log('\n🔚 Goodbye phrase detected after email collection');
                        console.log('⏰ Call will end in 5 seconds...');
                        
                        setTimeout(endCall, 5000);
                    }
                }

                if (event.type === 'input_audio_buffer.speech_started') {
                    console.log('🎤 User speaking...');
                }
                
                if (event.type === 'input_audio_buffer.speech_stopped') {
                    console.log('🎤 User finished speaking');
                }
                
            } catch (error) {
                console.error('❌ Error processing OpenAI message:', error);
            }
        });
        
        openAiWs.on('error', (error) => {
            console.error('❌ OpenAI WebSocket error:', error.message);
        });
        
        openAiWs.on('close', (code, reason) => {
            console.log(`💬 OpenAI WebSocket closed: Code ${code}. Reason: ${reason || 'No reason provided'}`);
        });
        
        connection.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                
                switch (data.event) {
                    case 'media':
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
                        callSid = data.start.callSid || streamSid;
                        
                        console.log(`✅ Call stream started - SID: ${streamSid}, CallSID: ${callSid}`);
                        
                        // Find call data using fallback methods if needed
                        currentCallData = activeCallsMap.get(callSid);
                        if (!currentCallData) {
                            console.log(`⚠️ No direct match for callSid ${callSid}, checking alternatives...`);
                            // Try to find the call data by other means
                            for (const [key, value] of activeCallsMap.entries()) {
                                if (streamSid.includes(key.substring(0, 10)) || key.includes(streamSid.substring(0, 10))) {
                                    console.log(`✅ Found alternative match: ${key}`);
                                    currentCallData = value;
                                    callSid = key;
                                    break;
                                }
                            }
                        }
                        
                        if (currentCallData) {
                            console.log(`📞 Call with ${currentCallData.name} (${currentCallData.phoneNumber})`);
                        } else {
                            console.log('⚠️ No call data found for this stream');
                        }
                        break;
                }
            } catch (error) {
                console.error('❌ Error processing Twilio message:', error);
            }
        });
        
        connection.on('close', () => {
            console.log('📞 Twilio connection closed');
            if (openAiWs.readyState === WebSocket.OPEN) {
                openAiWs.close();
            }
        });
    });
});

fastify.post('/webhook/status', async (request, reply) => {
    const { CallSid, CallStatus } = request.body;
    const callData = activeCallsMap.get(CallSid);

    if (callData) {
        console.log(`📞 Call to ${callData.name} status: ${CallStatus}`);
        
        if (CallStatus === 'completed') {
            try {
                const currentStatus = await csvService.getContactStatus(callData.phoneNumber);
                const finalStatus = currentStatus === 'Email Collected' 
                    ? 'Call Completed - Email Collected' 
                    : 'Call Completed - Not Interested';
                
                await csvService.updateContact(callData.phoneNumber, {
                    Status: finalStatus
                });
            } catch (error) {
                console.error('❌ Error updating final status:', error);
            }
            activeCallsMap.delete(CallSid);
        } else if (CallStatus === 'failed') {
            try {
                await csvService.updateContact(callData.phoneNumber, {
                    Status: 'Call Failed'
                });
            } catch (error) {
                console.error('❌ Error updating failed status:', error);
            }
            activeCallsMap.delete(CallSid);
        }
    }

    reply.send({ received: true });
});

const start = async () => {
    try {
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`✅ Server running on port ${PORT}`);
        
        console.log('\n📞 OUTBOUND CALL SYSTEM 📞');
        console.log('---------------------------');
        console.log('Starting to process contacts from CSV...\n');
        
        console.log('Environment Check:');
        console.log('BASE_URL:', process.env.BASE_URL);
        console.log('TWILIO_PHONE_NUMBER:', process.env.TWILIO_PHONE_NUMBER);
        console.log('Port:', PORT);
        
        await processCallQueue();
        
    } catch (err) {
        console.error('❌ Startup error:', err);
        process.exit(1);
    }
};

start();
