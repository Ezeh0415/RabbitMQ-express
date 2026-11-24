import crypto from 'crypto';

// rawBody must be the raw request body (Buffer or string), not the parsed object
export function verifyPaystack(rawBody: string, signature:string | undefined, secretKey:string) {
    if (!signature) return false; // If signature is null here, return false directly
    const expected = crypto
        .createHmac('sha512', secretKey)
        .update(rawBody)
        .digest('hex');
    // Use timingSafeEqual for secure comparison
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}