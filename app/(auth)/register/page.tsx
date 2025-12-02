"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export default function RegisterPage() {
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        role: "TEACHER",
    });
    const [error, setError] = useState("");

    const submit = async () => {
        const res = await fetch("/api/auth/register", {
            method: "POST",
            body: JSON.stringify(form),
            headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
            setError("Registration failed");
        } else {
            window.location.href = "/login";
        }
    };

    return (
        <div className="mx-auto mt-16 max-w-md rounded-xl border bg-card p-6 shadow-sm">
            <h1 className="mb-4 text-2xl font-semibold">Create account</h1>
            <Input
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mb-3"
            />
            <Input
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mb-3"
            />
            <Input
                placeholder="Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="mb-4"
            />
            <Select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="mb-4"
            >
                <option value="TEACHER">Teacher</option>
                <option value="STUDENT">Student</option>
            </Select>
            {error && <p className="mb-2 text-sm text-red-500">{error}</p>}
            <Button className="w-full" onClick={submit}>
                Register
            </Button>
            <p className="mt-3 text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link className="text-primary underline" href="/login">
                    Login
                </Link>
            </p>
        </div>
    );
}
