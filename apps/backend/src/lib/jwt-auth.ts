import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4111';
const JWKS_URL = `${BACKEND_URL}/auth/jwks`;

const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

export interface NutriaJwtPayload extends JWTPayload {
  sub: string;
  email: string;
  name?: string;
}

/**
 * Verifica e decodifica um JWT usando as chaves públicas do JWKS do backend.
 */
export async function verifyJwt(token: string): Promise<NutriaJwtPayload> {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: BACKEND_URL,
    audience: 'nutria',
  });

  if (!payload.sub) {
    throw new Error('JWT missing sub claim');
  }

  return payload as NutriaJwtPayload;
}

/**
 * Extrai o Bearer token do header Authorization.
 * Retorna null se o header não existir ou não for Bearer.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}
