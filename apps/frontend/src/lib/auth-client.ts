import { createAuthClient } from "better-auth/react";
import { jwtClient } from "better-auth/client/plugins";
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4111",
  basePath: "/auth",
  fetchOptions: {
    credentials: "include",
  },
  plugins: [
    jwtClient(),
    inferAdditionalFields<{
      user: {
        planType: string;
        avatarUrl: string;
      };
    }>(),
  ],
});

export const {
  useSession,
  signIn,
  signUp,
  signOut,
  $fetch,
} = authClient;
