"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { motion } from "framer-motion";
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
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60"
    >
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 group"
            onClick={() => playSound("click")}
          >
            <motion.div
              whileHover={{ rotate: 10, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <GraduationCap className="h-8 w-8 text-primary transition-colors group-hover:text-primary/80" />
            </motion.div>
            <span className="text-xl font-bold gradient-text">
              Assessment Checker
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navigation.map((item, index) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 + 0.2 }}
                >
                  <Link href={item.href} onClick={() => playSound("click")}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={`gap-2 relative ${
                        isActive ? "glow-sm" : ""
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                      {isActive && (
                        <motion.div
                          layoutId="navbar-indicator"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                    </Button>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>

        <motion.div
          className="flex items-center gap-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <ThemeSelector />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full hover-glow"
                onClick={() => playSound("click")}
              >
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Avatar className="border-2 border-transparent hover:border-primary transition-colors">
                    <AvatarImage
                      src={session.user?.avatar || undefined}
                      alt={session.user?.name || ""}
                    />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getInitials(session.user?.name || "U")}
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 glass" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none gradient-text">
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
              <DropdownMenuItem asChild>
                <Link
                  href="/settings"
                  className="cursor-pointer"
                  onClick={() => playSound("click")}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/profile"
                  className="cursor-pointer"
                  onClick={() => playSound("click")}
                >
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={() => {
                  playSound("click");
                  signOut({ callbackUrl: "/login" });
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>
      </div>
    </motion.nav>
  );
}
