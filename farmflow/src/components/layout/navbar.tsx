"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Calendar,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { useSidebar } from "./sidebar-context";
import { useBranch, type BranchOption } from "./branch-context";
import { logoutAction } from "@/server/actions/auth.actions";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dispatch": "Hen Dispatch",
  "/sales": "Retail Sales",
  "/expenses": "Expenses",
  "/branches": "Branches",
  "/reports": "Reports",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  if (routeTitles[pathname]) return routeTitles[pathname];

  for (const [route, title] of Object.entries(routeTitles)) {
    if (pathname.startsWith(route + "/")) return title;
  }

  return "Dashboard";
}

function BranchSelect({
  branches,
  canViewAllBranches,
  value,
  onChange,
  className,
}: {
  branches: BranchOption[];
  canViewAllBranches: boolean;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const showAllOption = canViewAllBranches || branches.length > 1;

  if (branches.length === 0) {
    return (
      <div className="flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-sm text-gray-500">
        <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
        <span className="truncate">No Branch Assigned</span>
      </div>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={!showAllOption && branches.length === 1}
    >
      <SelectTrigger aria-label="Select Branch" className={className}>
        <span className="flex items-center gap-2 min-w-0">
          <Building2 className="h-4 w-4 text-[#079B50] shrink-0" />
          <SelectValue placeholder="Select Branch" />
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          <SelectLabel>Branches</SelectLabel>
          {showAllOption && (
            <>
              <SelectItem value="all">
                {canViewAllBranches ? "All Branches" : "All Assigned Branches"}
              </SelectItem>
              <SelectSeparator />
            </>
          )}
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branch.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { toggleMobile } = useSidebar();
  const {
    user,
    branches,
    canViewAllBranches,
    selectedBranchId,
    setSelectedBranchId,
    selectedDate,
    setSelectedDate,
  } = useBranch();
  const [isPending, startTransition] = useTransition();

  const pageTitle = getPageTitle(pathname);

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] print:hidden">
      {/* Primary Top Bar */}
      <div className="h-16 px-4 sm:px-6 flex items-center justify-between gap-3">
        {/* Left: Mobile Menu Toggle + Page Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={toggleMobile}
            className="lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#17212B] hover:bg-gray-50 cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#17212B] truncate">
            {pageTitle}
          </h1>
        </div>

        {/* Right: Desktop Branch & Date Selectors + User Menu */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Desktop Branch Selector */}
          <div className="hidden md:block w-52">
            <BranchSelect
              branches={branches}
              canViewAllBranches={canViewAllBranches}
              value={selectedBranchId}
              onChange={setSelectedBranchId}
            />
          </div>

          {/* Desktop Date Selector */}
          <div className="hidden md:flex h-11 items-center gap-2 bg-white border border-[#E5E7EB] rounded-xl px-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-gray-300 transition-colors">
            <Calendar className="h-4 w-4 text-gray-500 shrink-0" />
            <label htmlFor="desktop-date-select" className="sr-only">
              Select Date
            </label>
            <input
              id="desktop-date-select"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm sm:text-base font-medium text-[#17212B] outline-none cursor-pointer"
            />
          </div>

          {/* User Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-11 items-center gap-2.5 rounded-xl border border-[#E5E7EB] bg-white px-2 sm:px-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-gray-300 hover:bg-gray-50/40 focus:outline-none focus:ring-2 focus:ring-[#079B50]/15 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-[#092F2B] flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-semibold">
                    {user.initials}
                  </span>
                </div>
                <div className="hidden lg:block text-left pr-0.5">
                  <p className="text-sm font-semibold text-[#17212B] leading-tight">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500 leading-tight">
                    {user.roleLabel}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <p className="text-base font-semibold text-[#17212B] truncate">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {user.roleLabel} &bull; {user.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <User className="h-4 w-4 text-gray-500" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="h-4 w-4 text-gray-500" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={handleLogout}
                disabled={isPending}
                className="text-red-600 hover:bg-red-50 focus:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                <span>{isPending ? "Signing out..." : "Logout"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile Branch & Date Strip */}
      <div className="md:hidden grid grid-cols-2 gap-2.5 px-4 pb-3 pt-2 border-t border-gray-100 bg-white">
        <BranchSelect
          branches={branches}
          canViewAllBranches={canViewAllBranches}
          value={selectedBranchId}
          onChange={setSelectedBranchId}
          className="h-11 bg-[#F7F9FA]"
        />

        <div className="flex h-11 items-center gap-2 bg-[#F7F9FA] border border-[#E5E7EB] rounded-xl px-3">
          <Calendar className="h-4 w-4 text-gray-500 shrink-0" />
          <label htmlFor="mobile-date-select" className="sr-only">
            Select Date
          </label>
          <input
            id="mobile-date-select"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full bg-transparent text-sm font-medium text-[#17212B] outline-none cursor-pointer min-w-0"
          />
        </div>
      </div>
    </header>
  );
}

export default Navbar;
