import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";
import AzureADProvider from "next-auth/providers/azure-ad";
import AppleProvider from "next-auth/providers/apple";
import FacebookProvider from "next-auth/providers/facebook";
import DiscordProvider from "next-auth/providers/discord";
import TwitterProvider from "next-auth/providers/twitter";
import LinkedInProvider from "next-auth/providers/linkedin";

// Server-side only — not exposed to browser
const BASE_URL = process.env.BACKEND_URL || "http://localhost:8000";
const SOCIAL_SECRET = process.env.SOCIAL_LOGIN_SECRET || "dev-social-secret";

// Only include providers whose env vars are present
const providers = [];

if (process.env.GOOGLE_CLIENT_ID) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

if (process.env.GITHUB_ID) {
  providers.push(
    GithubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    })
  );
}

if (process.env.AZURE_AD_CLIENT_ID) {
  providers.push(
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID || "common",
    })
  );
}

if (process.env.APPLE_ID) {
  providers.push(
    AppleProvider({
      clientId: process.env.APPLE_ID,
      clientSecret: process.env.APPLE_SECRET,
    })
  );
}

if (process.env.FACEBOOK_CLIENT_ID) {
  providers.push(
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    })
  );
}

if (process.env.DISCORD_CLIENT_ID) {
  providers.push(
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    })
  );
}

if (process.env.TWITTER_CLIENT_ID) {
  providers.push(
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      version: "2.0",
    })
  );
}

if (process.env.LINKEDIN_CLIENT_ID) {
  providers.push(
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    })
  );
}

export default NextAuth({
  providers,
  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        // First sign-in: exchange social profile for our backend JWT
        try {
          const res = await fetch(`${BASE_URL}/api/auth/social`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-social-secret": SOCIAL_SECRET,
            },
            body: JSON.stringify({
              provider: account.provider,
              provider_id: account.providerAccountId,
              email: token.email || "",
              name: token.name || "",
              avatar_url: token.picture || "",
            }),
          });

          if (res.ok) {
            const data = await res.json();
            token.backendToken = data.access_token;
            token.backendUser = data.user;
          } else {
            token.backendError = `Backend returned ${res.status}`;
          }
        } catch (err) {
          token.backendError = "Backend unreachable";
        }
      }
      return token;
    },

    async session({ session, token }) {
      session.backendToken = token.backendToken;
      session.backendUser = token.backendUser;
      session.backendError = token.backendError;
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
});
