import type { Metadata } from "next";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import "./globals.css";
import Link from "next/link";
import AdminNavigation from "./components/AdminNavigation";

export const metadata: Metadata = {
  title: "terribly made notes app",
  description: "AI-powered notes app with audio transcription",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <header className="header">
            <div className="container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Link href="/" className="title" style={{ textDecoration: 'none', color: 'inherit' }}>
                  terribly made notes app
                </Link>
                <nav style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <SignedIn>
                    <AdminNavigation />
                    <UserButton />
                  </SignedIn>
                  <SignedOut>
                    <SignInButton mode="modal">
                      <button className="btn btn-primary">Sign In</button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <button className="btn btn-secondary">Sign Up</button>
                    </SignUpButton>
                  </SignedOut>
                </nav>
              </div>
            </div>
          </header>
          <main>
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}
