"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeSelector } from "@/components/theme-selector";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { useSoundEffects } from "@/hooks/use-sound-effects";

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isTeacher = session?.user?.role === "TEACHER";
  const { playSound } = useSoundEffects();

  if (!session) return null;

  const navigation = isTeacher
    ? [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Classes", href: "/classes", icon: Users },
      ]
    : [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "My Classes", href: "/classes", icon: BookOpen },
      ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-[1600px] px-6 md:px-10 lg:px-16 flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 group"
            onClick={() => playSound("click")}
          >
            <GraduationCap className="h-8 w-8 text-primary transition-all group-hover:rotate-6 group-hover:scale-110" />
            <span className="text-xl font-bold gradient-text">
              Assessment Checker
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link key={item.name} href={item.href} onClick={() => playSound("click")}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={`gap-2 relative ${isActive ? "glow-sm" : ""}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ThemeSelector />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative h-10 w-10 rounded-full hover:ring-2 hover:ring-primary/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <Avatar className="h-10 w-10 border-2 border-transparent hover:border-primary transition-colors">
                  <AvatarImage
                    src={session.user?.avatar || undefined}
                    alt={session.user?.name || ""}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {getInitials(session.user?.name || "U")}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {session.user?.name}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {session.user?.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground capitalize mt-1">
                    {session.user?.role?.toLowerCase()}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => router.push("/settings")}
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => router.push("/profile")}
              >
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
