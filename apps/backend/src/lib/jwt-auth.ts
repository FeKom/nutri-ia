import { jwtVerify, type JWTPayload } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET_KEY || 'change-me-in-production'
);

export interface NutriaJwtPayload extends JWTPayload {
  sub: string;
  username: string;
  name?: string;
}

/**
 * Verifies and decodes a JWT using the shared HS256 secret.
 */
export async function verifyJwt(token: string): Promise<NutriaJwtPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET, {
    issuer: 'nutria-catalog',
    audience: 'nutria',
  });

  if (!payload.sub) {
    throw new Error('JWT missing sub claim');
  }

  return payload as NutriaJwtPayload;
}

/**
 * Extracts the Bearer token from an Authorization header.
 * Returns null if missing or not a Bearer token.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}
