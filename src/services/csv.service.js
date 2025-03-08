// src/services/csv.service.js
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync'; // Make sure this is correct
import path from 'path';

class CSVService {
    constructor() {
        this.csvPath = path.join(process.cwd(), 'contacts.csv');
        this.headers = ['Name', 'Phone Number', 'Email', 'Status'];
        this.initializeCSV();
    }

    initializeCSV() {
        try {
            if (!fs.existsSync(this.csvPath)) {
                console.log('📝 CSV file not found, creating new one...');
                const initialContent = stringify([{}], {
                    header: true,
                    columns: this.headers
                });
                fs.writeFileSync(this.csvPath, initialContent);
                console.log('✅ Created new contacts.csv file with headers');
            } else {
                console.log('✅ CSV file exists');
                // Check if file is writable
                try {
                    fs.accessSync(this.csvPath, fs.constants.W_OK);
                    console.log('✅ CSV file is writable');
                } catch (err) {
                    console.error('❌ CSV file is not writable:', err);
                }
            }
        } catch (error) {
            console.error('❌ Error initializing CSV:', error);
        }
    }

    async readContacts() {
        try {
            console.log('📖 Reading contacts from CSV...');
            const fileContent = fs.readFileSync(this.csvPath, 'utf-8');
            const records = parse(fileContent, {
                columns: true,
                skip_empty_lines: true
            });
            console.log(`✅ Successfully read ${records.length} contacts`);
            return records;
        } catch (error) {
            console.error('❌ Error reading CSV file:', error);
            throw error;
        }
    }

    async updateContact(phoneNumber, updates) {
        try {
            console.log(`📝 Updating contact with phone number: ${phoneNumber}`);
            console.log('Updates to apply:', updates);

            // Create backup before update
            const backupFile = `${this.csvPath}.backup`;
            fs.copyFileSync(this.csvPath, backupFile);
            
            // Read current contacts
            const fileContent = fs.readFileSync(this.csvPath, 'utf-8');
            const contacts = parse(fileContent, {
                columns: true,
                skip_empty_lines: true
            });

            let updated = false;
            const updatedContacts = contacts.map(contact => {
                if (contact['Phone Number'] === phoneNumber) {
                    updated = true;
                    const updatedContact = { ...contact, ...updates };
                    console.log('Updated contact data:', updatedContact);
                    return updatedContact;
                }
                return contact;
            });

            if (!updated) {
                console.error(`❌ No contact found with phone number: ${phoneNumber}`);
                return false;
            }

            // Write updated contacts synchronously
            const output = stringify(updatedContacts, {
                header: true,
                columns: this.headers
            });
            
            fs.writeFileSync(this.csvPath, output);
            console.log(`✅ CSV file updated for ${phoneNumber}`);
            
            // Verify the update immediately
            const newContent = fs.readFileSync(this.csvPath, 'utf-8');
            const verificationContacts = parse(newContent, {
                columns: true,
                skip_empty_lines: true
            });
            
            const verifiedContact = verificationContacts.find(c => c['Phone Number'] === phoneNumber);
            
            if (verifiedContact) {
                const allUpdatesApplied = Object.entries(updates).every(
                    ([key, value]) => verifiedContact[key] === value
                );
                
                if (allUpdatesApplied) {
                    console.log('✅ Contact update verified successfully');
                    // Remove backup after successful verification
                    fs.unlinkSync(backupFile);
                    return true;
                } else {
                    console.error('❌ Update verification failed');
                    // Restore from backup
                    fs.copyFileSync(backupFile, this.csvPath);
                    return false;
                }
            } else {
                console.error('❌ Updated contact not found in verification');
                // Restore from backup
                fs.copyFileSync(backupFile, this.csvPath);
                return false;
            }
        } catch (error) {
            console.error('❌ Error updating CSV file:', error);
            return false;
        }
    }

    async getContactStatus(phoneNumber) {
        try {
            console.log(`🔍 Getting status for contact: ${phoneNumber}`);
            const contacts = await this.readContacts();
            const contact = contacts.find(c => c['Phone Number'] === phoneNumber);
            
            if (contact) {
                console.log(`📋 Current status for ${phoneNumber}: ${contact.Status}`);
                return contact.Status;
            } else {
                console.log(`❌ No contact found with phone number: ${phoneNumber}`);
                return null;
            }
        } catch (error) {
            console.error('❌ Error getting contact status:', error);
            return null;
        }
    }
}

export default new CSVService();
