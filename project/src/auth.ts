import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import client from "@/lib/mongodb";
import { connectDB } from "@/lib/mongoose";
import { User } from "@/models/User";
import { verifyCredentials } from "@/lib/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(client),
  // O provider Credentials só funciona com sessão JWT.
  session: { strategy: "jwt" },
  providers: [
    Google,
    Credentials({
      credentials: {
        email: { type: "email", label: "Email" },
        password: { type: "password", label: "Senha" },
      },
      authorize: (credentials) =>
        verifyCredentials(credentials, async (email) => {
          await connectDB();
          const user = await User.findOne({ email }).select("+passwordHash").lean();
          if (!user) return null;
          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            image: user.image,
            passwordHash: user.passwordHash,
          };
        }),
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
