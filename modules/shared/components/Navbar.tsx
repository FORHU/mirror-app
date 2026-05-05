"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "./Button";
import { ThemeToggle } from "./ThemeToggle";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { Dropdown, DropdownItem } from "./Dropdown";
import { useRouter } from "next/navigation";

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const userMenuItems: DropdownItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
      ),
      onClick: () => router.push("/dashboard"),
    },
    {
      id: "settings",
      label: "Settings",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      onClick: () => router.push("/dashboard"),
    },
    {
      id: "logout",
      label: "Log out",
      destructive: true,
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" x2="9" y1="12" y2="12" />
        </svg>
      ),
      onClick: () => {
        logout();
        router.push("/");
      },
    },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 py-4 ${
        isScrolled
          ? "bg-background-primary/80 backdrop-blur-md border-b border-border-default h-16"
          : "bg-transparent h-20"
      }`}
    >
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-core to-brand-vibrant flex items-center justify-center glow-primary group-hover:scale-110 transition-transform duration-500 overflow-hidden">
             <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <span className="text-xl font-bold tracking-tighter text-gradient-2026 hidden sm:block">BOILERPLATE</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/#features"
            className="text-sm font-bold text-text-tertiary hover:text-brand-light transition-colors uppercase tracking-widest"
          >
            Features
          </Link>
          <Link
            href="/#specs"
            className="text-sm font-bold text-text-tertiary hover:text-brand-light transition-colors uppercase tracking-widest"
          >
            Specs
          </Link>
          <Link
            href="/#sample"
            className="text-sm font-bold text-text-tertiary hover:text-brand-light transition-colors uppercase tracking-widest"
          >
            Sample
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />

          {isAuthenticated ? (
            <Dropdown
              trigger={
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background-tertiary border border-border-default hover:bg-background-elevated transition-colors">
                  <div className="w-6 h-6 rounded-full bg-brand-vibrant flex items-center justify-center text-[10px] text-white font-bold">
                    {user?.username?.[0]?.toUpperCase() || "U"}
                  </div>
                  <span className="text-sm font-medium text-text-primary">
                    {user?.username}
                  </span>
                </div>
              }
              items={userMenuItems}
            />
          ) : (
            <>
              <Link href="/auth">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="primary" size="sm">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
