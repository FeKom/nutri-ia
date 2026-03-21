"use client";

import { redirect } from "next/navigation";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "@/lib/auth-client";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type Goal = {
  id: string;
  title: string;
  description?: string;
  target_value: number;
  current_value: number;
  category: string;
  deadline?: string;
  created_at: string;
};

export default function GoalsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [name, setName] = useState("");
  redirect("/metas");
  1;
}
