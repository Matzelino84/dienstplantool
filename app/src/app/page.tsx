"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
    } else if (isAdmin) {
      router.replace("/admin");
    } else {
      router.replace("/wunschplan");
    }
  }, [user, isAdmin, isLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
    </div>
  );
}
