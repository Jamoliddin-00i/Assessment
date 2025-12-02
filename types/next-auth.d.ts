import { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            role: "TEACHER" | "STUDENT";
        } & DefaultSession["user"];
    }

    interface User {
        role: "TEACHER" | "STUDENT";
    }
}
