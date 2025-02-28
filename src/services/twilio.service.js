import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

class TwilioService {
    constructor() {
        this.client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );
        this.twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    }

    async makeOutboundCall(toNumber) {
        try {
            console.log('Making call to:', toNumber);
            console.log('From number:', this.twilioNumber);
            
            const webhookUrl = `${process.env.BASE_URL}/webhook/voice`;
            console.log('Webhook URL:', webhookUrl);
            
            const call = await this.client.calls.create({
                url: webhookUrl,
                to: toNumber,
                from: this.twilioNumber,
                statusCallback: `${process.env.BASE_URL}/webhook/status`,
                statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
            });

            console.log('Call SID:', call.sid);
            return call.sid;
        } catch (error) {
            console.error('Error making outbound call:', error);
            throw error;
        }
    }
}

export default new TwilioService();
