"use client";

import React, { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  ShoppingCart,
  Receipt,
  Building2,
  BarChart3,
  Settings,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { useSidebar } from "./sidebar-context";
import { useBranch } from "./branch-context";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth.actions";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  allowedRoles: Role[];
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    allowedRoles: ["OWNER", "BRANCH_MANAGER", "SALES_EMPLOYEE"],
  },
  {
    label: "Hen Dispatch",
    href: "/dispatch",
    icon: Truck,
    allowedRoles: ["OWNER", "BRANCH_MANAGER"],
  },
  {
    label: "Retail Sales",
    href: "/sales",
    icon: ShoppingCart,
    allowedRoles: ["OWNER", "BRANCH_MANAGER", "SALES_EMPLOYEE"],
  },
  {
    label: "Expenses",
    href: "/expenses",
    icon: Receipt,
    allowedRoles: ["OWNER", "BRANCH_MANAGER"],
  },
  {
    label: "Branches",
    href: "/branches",
    icon: Building2,
    allowedRoles: ["OWNER", "BRANCH_MANAGER"],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    allowedRoles: ["OWNER", "BRANCH_MANAGER"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    allowedRoles: ["OWNER", "BRANCH_MANAGER", "SALES_EMPLOYEE"],
  },
];

function BrandMark() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#079B50] text-lg font-bold text-white">
      F
    </div>
  );
}

function SidebarNavLinks({
  collapsed,
  role,
  onNavigate,
}: {
  collapsed: boolean;
  role: Role;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) =>
    item.allowedRoles.includes(role)
  );

  return (
    <nav
      className="mt-2 flex flex-1 flex-col gap-1.5 px-3"
      aria-label="Main Navigation"
    >
      {visibleItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors",
              isActive
                ? "bg-[#079B50] text-white"
                : "text-gray-200 hover:bg-[#0D3F38] hover:text-white",
              collapsed && "justify-center px-0"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function LogoutButton({
  collapsed,
  onClick,
  isPending,
}: {
  collapsed: boolean;
  onClick: () => void;
  isPending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      title={collapsed ? "Logout" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-base font-medium text-gray-200 hover:bg-[#0D3F38] hover:text-white transition-colors cursor-pointer disabled:opacity-50",
        collapsed && "justify-center px-0"
      )}
    >
      <LogOut className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{isPending ? "Signing out..." : "Logout"}</span>}
    </button>
  );
}

export function Sidebar() {
  const { collapsed, toggle, mobileOpen, closeMobile } = useSidebar();
  const { user } = useBranch();
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    closeMobile();
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex print:hidden sticky top-0 h-screen shrink-0 flex-col bg-[#092F2B] text-white border-r border-[#0D3F38]",
          collapsed ? "w-[76px]" : "w-[260px]"
        )}
      >
        {/* Logo & Collapse Area */}
        <div
          className={cn(
            "flex items-center px-4 py-5 border-b border-white/10",
            collapsed ? "flex-col gap-3 justify-center" : "justify-between"
          )}
        >
          <Link href="/dashboard" className="flex items-center gap-3">
            <BrandMark />
            {!collapsed && (
              <div>
                <span className="text-xl font-bold tracking-tight text-white block leading-tight">
                  FarmFlow
                </span>
                <span className="text-xs text-emerald-200/80">
                  Chicken Shop Manager
                </span>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={toggle}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-300 hover:bg-[#0D3F38] hover:text-white cursor-pointer"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRight className="h-5 w-5" />
            ) : (
              <ChevronsLeft className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <SidebarNavLinks collapsed={collapsed} role={user.role} />

        {/* Logout */}
        <div className="px-3 pb-5 pt-3 border-t border-white/10">
          <LogoutButton
            collapsed={collapsed}
            onClick={handleLogout}
            isPending={isPending}
          />
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={closeMobile}
            aria-hidden="true"
          />
          <aside className="fixed left-0 top-0 bottom-0 z-50 flex w-[280px] flex-col bg-[#092F2B] text-white shadow-xl">
            <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
              <Link
                href="/dashboard"
                onClick={closeMobile}
                className="flex items-center gap-3"
              >
                <BrandMark />
                <div>
                  <span className="text-xl font-bold tracking-tight text-white block leading-tight">
                    FarmFlow
                  </span>
                  <span className="text-xs text-emerald-200/80">
                    Chicken Shop Manager
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={closeMobile}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-300 hover:bg-[#0D3F38] hover:text-white cursor-pointer"
                aria-label="Close menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <SidebarNavLinks
              collapsed={false}
              role={user.role}
              onNavigate={closeMobile}
            />

            <div className="px-3 pb-5 pt-3 border-t border-white/10">
              <LogoutButton
                collapsed={false}
                onClick={handleLogout}
                isPending={isPending}
              />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

export default Sidebar;
