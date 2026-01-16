'use client';

import { useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function AdminNavigation() {
  const { user, isLoaded } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded && user) {
      checkAdminStatus();
    }
  }, [isLoaded, user]);

  const checkAdminStatus = async () => {
    try {
      const response = await fetch('/api/admin/models');
      setIsAdmin(response.ok);
    } catch (error) {
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || loading || !isAdmin) {
    return null;
  }

  return (
    <Link href="/admin/models" className="btn btn-secondary" style={{ backgroundColor: '#3b82f6', color: 'white' }}>
      ⚙️ Settings
    </Link>
  );
}
