"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle"; // I need to create this
import { User } from "next-auth";

interface NavbarProps {
    user: {
        name?: string | null;
        email?: string | null;
        role: "TEACHER" | "STUDENT";
    };
}

export function Navbar({ user }: NavbarProps) {
    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center">
                <div className="mr-4 hidden md:flex">
                    <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
                        <span className="hidden font-bold sm:inline-block">
                            Assessment Platform
                        </span>
                    </Link>
                    <nav className="flex items-center space-x-6 text-sm font-medium">
                        <Link
                            href="/dashboard"
                            className="transition-colors hover:text-foreground/80 text-foreground"
                        >
                            Dashboard
                        </Link>
                        {user.role === "TEACHER" && (
                            <Link
                                href="/classes/new"
                                className="transition-colors hover:text-foreground/80 text-foreground/60"
                            >
                                Create Class
                            </Link>
                        )}
                        {user.role === "STUDENT" && (
                            <Link
                                href="/join-class"
                                className="transition-colors hover:text-foreground/80 text-foreground/60"
                            >
                                Join Class
                            </Link>
                        )}
                    </nav>
                </div>
                <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                    <div className="w-full flex-1 md:w-auto md:flex-none">
                        {/* Search or other items */}
                    </div>
                    <nav className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground mr-2">
                            {user.name} ({user.role})
                        </span>
                        <ThemeToggle />
                        <Button variant="ghost" size="sm" onClick={() => signOut()}>
                            Log out
                        </Button>
                    </nav>
                </div>
            </div>
        </header>
    );
}
