'use client';

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home since user settings are disabled
    router.push('/');
  }, [router]);

  return (
    <div className="container">
      <div className="card">
        <h2>Settings Unavailable</h2>
        <p>User settings have been disabled. Only administrators can configure API settings.</p>
        <p>Redirecting to home...</p>
      </div>
    </div>
  );
}
