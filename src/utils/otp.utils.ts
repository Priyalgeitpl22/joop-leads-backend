import { randomBytes } from 'crypto';

export const generateOtp = (): { code: string, expiresAt: Date } => {
    const otpCode = randomBytes(3).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);
    
    return { code: otpCode, expiresAt };
};

export const generateRandomPassword = (length: number): string => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let password = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      password += characters[randomIndex];
    }
    return password;
};