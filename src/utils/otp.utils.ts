import { randomBytes } from 'crypto';

export const generateOtp = (): { code: string, expiresAt: Date } => {
    const otpCode = randomBytes(3).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);
    
    return { code: otpCode, expiresAt };
};
