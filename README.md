# AI-Powered Outbound Call Agent

This project implements an automated outbound call agent powered by AI

## Technologies Used

*   **Backend:** Node.js with Fastify
*   **Voice Synthesis:** ElevenLabs
*   **Conversation AI:** OpenAI
*   **Telephony:** Twilio
*   **Data Storage:** Local file-based audio storage
*   **Other Libraries:** `dotenv`, `ws`, `axios`, `uuid`

## Key Features

*   Automated outbound calls
*   AI-driven conversation (OpenAI)
*   Real-time audio streaming (ElevenLabs)
*   Basic call flow
*   Optimized response handling

## Project Structure





outbound_callagent/ ├── src/ │ ├── index.js (Main server) │ ├── services/ │ │ ├── callManager.service.js │ │ ├── openai.service.js │ │ ├── elevenlabs.service.js │ │ └── twilio.service.js │ ├── tests/ │ │ ├── integration.test.js │ │ ├── openai.test.js │ │ ├── elevenlabs.test.js │ │ └── twilio.test.js │ ├── config/ │ │ └── urls.js │ └── utils/ ├── temp-audio/ (Temporary audio storage) ├── .env (Environment variables - DO NOT COMMIT) ├── .gitignore (Git ignore file) ├── package.json (Project dependencies) └── README.md (This file)

Code



## Setup

1.  **Clone the repository:**
    ```bash
    git clone sherrybabe1978/outbound-callagent
    cd outbound_callagent




Install dependencies:
bash


    npm install




Set up environment variables:
Create a .env file in the project root.

Populate the .env file with your API keys and configuration:

env


    ELEVENLABS_API_KEY=YOUR_ELEVENLABS_API_KEY
    ELEVENLABS_VOICE_ID=YOUR_ELEVENLABS_VOICE_ID
    OPENAI_API_KEY=YOUR_OPENAI_API_KEY
    TWILIO_ACCOUNT_SID=YOUR_TWILIO_ACCOUNT_SID
    TWILIO_AUTH_TOKEN=YOUR_TWILIO_AUTH_TOKEN
    TWILIO_PHONE_NUMBER=YOUR_TWILIO_PHONE_NUMBER
    BASE_URL=YOUR_NGROK_URL
    PORT=5050




Start ngrok (for local development):
bash


    ngrok http 5050




*   Update the `BASE_URL` in your `.env` file with the ngrok URL.
5. Run the server:

bash


    npm run dev




Testing
Run all tests:
bash


    npm run test:all




Run integration test:
bash


    npm run test:integration
