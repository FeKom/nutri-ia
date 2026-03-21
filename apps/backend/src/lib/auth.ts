import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { randomUUID } from "crypto";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4111";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const isProd = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  baseURL: BACKEND_URL,
  basePath: "/auth",
  database: pool,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dias
    updateAge: 60 * 60 * 24, // 1 dia
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutos
    },
  },

  user: {
    additionalFields: {
      planType: {
        type: "string",
        required: false,
        defaultValue: "free",
        input: true,
      },
      avatarUrl: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },

  trustedOrigins: [FRONTEND_URL],

  advanced: {
    database: {
      generateId: () => randomUUID(),
    },
    useSecureCookies: isProd,
    cookieOptions: {
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
      path: "/",
    },
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
  },

  plugins: [
    jwt({
      jwks: {
        keyPairConfig: {
          alg: "EdDSA",
          crv: "Ed25519",
        },
      },
      jwt: {
        issuer: BACKEND_URL,
        audience: "nutria",
        expirationTime: "15m",
        definePayload: ({ user }) => ({
          sub: user.id,
          email: user.email,
          name: user.name,
        }),
      },
    }),
  ],
});
