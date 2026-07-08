import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const KEY_FILE = path.join(DATA_DIR, 'secret.key');
const ALGORITHM = 'aes-256-cbc';

// Retrieve or generate the master key
let masterKey;

function getMasterKey() {
  if (masterKey) return masterKey;

  // 1. Try environment variable
  const envKey = process.env.SECRET_KEY;
  if (envKey && envKey !== 'change_this_to_a_secure_random_key_in_production' && envKey !== 'default_super_secret_rpa_key_123') {
    // Hash envKey to guarantee a 32-byte key
    masterKey = crypto.createHash('sha256').update(envKey).digest();
    return masterKey;
  }

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // 2. Try stored key file
  if (fs.existsSync(KEY_FILE)) {
    try {
      const stored = fs.readFileSync(KEY_FILE, 'utf8').trim();
      if (stored.length === 64) { // Hex of 32 bytes
        masterKey = Buffer.from(stored, 'hex');
        return masterKey;
      }
    } catch (e) {
      console.error('Error reading key file, generating a new one...', e);
    }
  }

  // 3. Fallback: generate a random key and store it
  console.log('No custom SECRET_KEY env variable provided. Generating a persistent master encryption key...');
  const randomKey = crypto.randomBytes(32);
  try {
    fs.writeFileSync(KEY_FILE, randomKey.toString('hex'), 'utf8');
  } catch (e) {
    console.error('Failed to write master key to disk. Secrets will not persist across restarts!', e);
  }
  
  masterKey = randomKey;
  return masterKey;
}

/**
 * Encrypt a text using AES-256-CBC.
 * @param {string} text - Plain text to encrypt.
 * @returns {string} Encrypted format: "iv_hex:ciphertext_hex"
 */
export function encrypt(text) {
  if (!text) return '';
  try {
    const key = getMasterKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt a string using AES-256-CBC.
 * @param {string} encryptedText - Encrypted format: "iv_hex:ciphertext_hex"
 * @returns {string} Decrypted plain text.
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return '';
  if (!encryptedText.includes(':')) {
    // If it is not formatted, it might not be encrypted yet or be a legacy string
    return encryptedText;
  }
  
  try {
    const key = getMasterKey();
    const [ivHex, ciphertextHex] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed. The secret key might have changed.', error);
    return '[[DECRYPTION_FAILED]]';
  }
}
