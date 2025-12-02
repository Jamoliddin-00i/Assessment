"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const submit = async () => {
        const res = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });
        if (res?.error) {
            setError("Invalid credentials");
        } else {
            window.location.href = "/teacher/dashboard";
        }
    };

    return (
        <div className="mx-auto mt-16 max-w-md rounded-xl border bg-card p-6 shadow-sm">
            <h1 className="mb-4 text-2xl font-semibold">Sign in</h1>
            <Input
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mb-3"
            />
            <Input
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mb-4"
            />
            {error && <p className="mb-2 text-sm text-red-500">{error}</p>}
            <Button className="w-full" onClick={submit}>
                Continue
            </Button>
            <p className="mt-3 text-sm text-muted-foreground">
                No account?{" "}
                <Link className="text-primary underline" href="/register">
                    Register
                </Link>
            </p>
        </div>
    );
}
