"use client";

import React, { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";

export interface BranchOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface SessionUserInfo {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleLabel: string;
  initials: string;
}

interface BranchContextType {
  user: SessionUserInfo;
  branches: BranchOption[];
  canViewAllBranches: boolean;
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  selectedBranch: BranchOption | null;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

function setClientCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=2592000; SameSite=Lax`;
}

interface BranchProviderProps {
  children: React.ReactNode;
  user: SessionUserInfo;
  branches: BranchOption[];
  canViewAllBranches: boolean;
  initialBranchId: string;
  initialDate: string;
}

export function BranchProvider({
  children,
  user,
  branches,
  canViewAllBranches,
  initialBranchId,
  initialDate,
}: BranchProviderProps) {
  const router = useRouter();
  const [selectedBranchId, setSelectedBranchIdState] =
    useState<string>(initialBranchId);
  const [selectedDate, setSelectedDateState] = useState<string>(initialDate);

  const setSelectedBranchId = (id: string) => {
    setSelectedBranchIdState(id);
    setClientCookie("farmflow_branch_id", id);
    router.refresh();
  };

  const setSelectedDate = (date: string) => {
    setSelectedDateState(date);
    setClientCookie("farmflow_date", date);
    router.refresh();
  };

  const selectedBranch =
    selectedBranchId === "all"
      ? null
      : branches.find((b) => b.id === selectedBranchId) ?? null;

  return (
    <BranchContext.Provider
      value={{
        user,
        branches,
        canViewAllBranches,
        selectedBranchId,
        setSelectedBranchId,
        selectedBranch,
        selectedDate,
        setSelectedDate,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return context;
}
