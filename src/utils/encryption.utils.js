/**
 * This file contains utilities for handling message encryption.
 *
 * Note: True end-to-end encryption requires client-side implementation where:
 * 1. Keys are generated and stored only on client devices
 * 2. Messages are encrypted before sending to server and decrypted after receiving
 * 3. The server never has access to the decryption keys
 *
 * This server-side implementation provides a foundation and interface for encryption
 * but would need to be integrated with client-side encryption to be truly end-to-end.
 */

import crypto from 'crypto';

/**
 * Generate a random encryption key
 * @returns {Object} Object containing encryption key and initialization vector
 */
export const generateEncryptionKey = () => {
  // Generate a random 256-bit key (32 bytes)
  const key = crypto.randomBytes(32).toString('base64');
  // Generate a random 128-bit IV (16 bytes)
  const iv = crypto.randomBytes(16).toString('base64');

  return { key, iv };
};

/**
 * Encrypt a message
 * @param {string} message - The plain text message to encrypt
 * @param {string} key - Base64 encoded encryption key
 * @param {string} iv - Base64 encoded initialization vector
 * @returns {string} Base64 encoded encrypted message
 */
export const encryptMessage = (message, key, iv) => {
  try {
    /* eslint no-undef: off */
    const keyBuffer = Buffer.from(key, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');

    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, ivBuffer);
    let encrypted = cipher.update(message, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get the authentication tag
    const authTag = cipher.getAuthTag().toString('base64');

    // Return encrypted message with auth tag
    return JSON.stringify({
      content: encrypted,
      tag: authTag,
      algorithm: 'aes-256-gcm',
    });
  } catch (error) {
    /* eslint no-console: off */
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt message');
  }
};

/**
 * Decrypt a message
 * @param {string} encryptedData - Stringified JSON object containing encrypted content and auth tag
 * @param {string} key - Base64 encoded encryption key
 * @param {string} iv - Base64 encoded initialization vector
 * @returns {string} Decrypted message
 */
export const decryptMessage = (encryptedData, key, iv) => {
  try {
    const { content, tag, algorithm } = JSON.parse(encryptedData);

    if (algorithm !== 'aes-256-gcm') {
      throw new Error('Unsupported encryption algorithm');
    }

    const keyBuffer = Buffer.from(key, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');
    const authTagBuffer = Buffer.from(tag, 'base64');

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      keyBuffer,
      ivBuffer,
    );
    decipher.setAuthTag(authTagBuffer);

    let decrypted = decipher.update(content, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt message');
  }
};

/**
 * Verify if a message is encrypted
 * @param {string} message - Message to check
 * @returns {boolean} True if the message is encrypted
 */
export const isEncrypted = (message) => {
  try {
    const parsed = JSON.parse(message);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      'content' in parsed &&
      'tag' in parsed &&
      'algorithm' in parsed
    );
    /* eslint no-unused-vars: off */
  } catch (e) {
    return false;
  }
};

/**
 * Handle an encrypted message for storage
 * This marks the message as encrypted but doesn't store the keys
 * @param {Object} messageData - Message data to be stored
 * @returns {Object} Modified message data with encryption metadata
 */
export const prepareEncryptedMessageForStorage = (messageData) => {
  // We don't modify the actual content, as it should already be encrypted by the client
  // We just mark it as encrypted for the system to know
  return {
    ...messageData,
    isEncrypted: true,
    // Store metadata about the encryption, but not the keys themselves
    encryptionMetadata: {
      encryptedAt: new Date().toISOString(),
      encryptionType: 'E2E', // End-to-End
    },
  };
};
