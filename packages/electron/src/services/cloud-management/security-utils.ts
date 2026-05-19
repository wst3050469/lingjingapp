import * as crypto from 'crypto';

export const generateApiKey = (): string => {
  const randomBytes = crypto.randomBytes(32).toString('base64url');
  return `lj_${randomBytes}`;
};

export const hashPassword = async (password: string, salt?: string): Promise<{ hash: string; salt: string }> => {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, actualSalt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      else resolve({
        hash: derivedKey.toString('hex'),
        salt: actualSalt
      });
    });
  });
};

export const verifyPassword = async (password: string, hash: string, salt: string): Promise<boolean> => {
  const { hash: newHash } = await hashPassword(password, salt);
  return newHash === hash;
};

export const generateAuthorizationCode = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

export const encryptData = (data: string, key: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

export const decryptData = (encryptedData: string, key: string): string => {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('base64url');
};

export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
};

export const isExpired = (expiresAt: string): boolean => {
  return new Date(expiresAt) < new Date();
};

export const getTimeUntilExpiry = (expiresAt: string): number => {
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  return Math.max(0, expiry - now);
};

export const generateChecksum = (data: string): string => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

export const maskSensitiveData = (data: string, visibleChars: number = 4): string => {
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length);
  }
  
  const start = data.substring(0, visibleChars);
  const end = data.substring(data.length - visibleChars);
  const middle = '*'.repeat(Math.min(data.length - visibleChars * 2, 10));
  
  return `${start}${middle}${end}`;
};
