import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "../utils/prisma";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
            // O callback deve apontar para o BACKEND onde o Better Auth está rodando
            redirectURI: `${process.env.BETTER_AUTH_URL || "http://localhost:3001"}/api/auth/callback/google`,
        },
    },
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 60 * 5, // 5 minutes
        },
    },
    advanced: {
        useSecureCookies: process.env.NODE_ENV === "production",
        // Para produção com domínios diferentes, NÃO usar crossSubDomainCookies
        // Isso causa problemas com Railway (.up.railway.app) e Vercel (.vercel.app)
        cookiePrefix: "better-auth",
    },
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
    basePath: "/api/auth",
    trustedOrigins: [
        process.env.FRONTEND_URL || "http://localhost:3000",
        process.env.BETTER_AUTH_URL || "http://localhost:3001",
        "https://sellaro.vercel.app", // URL de produção do frontend
        "https://sellarobackend-production.up.railway.app", // URL de produção do backend
    ],
});
