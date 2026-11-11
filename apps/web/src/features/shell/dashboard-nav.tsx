import {
  AlertCircle,
  ArrowRightLeft,
  Award,
  Calculator,
  Banknote,
  BarChart3,
  Boxes,
  Bug,
  CalendarCheck,
  CheckSquare,
  FileText,
  LayoutDashboard,
  Lightbulb,
  MapPin,
  Package,
  Route,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  Target,
  Wallet,
  UserCog,
  Truck,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

/**
 * Single source of truth for the dashboard sidebar navigation, shared by every
 * page via <DashboardShell>. Previously each page kept its own copy of this,
 * which drifted (esp. the ACCOUNTANT "Finance" section). The canonical nav here
 * is a superset so no role loses access.
 */

export type DashboardRole = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";

export type NavKey =
  | "dashboard"
  | "customers"
  | "orders"
  | "products"
  | "stock"
  | "invoices"
  | "collections"
  | "alerts"
  | "tasks"
  | "tracking"
  | "attendance"
  | "logistics"
  | "market-intelligence"
  | "reports"
  | "audit-logs"
  | "errors"
  | "incentives"
  | "targets"
  | "beat-plans"
  | "expenditures"
  | "users-teams"
  | "reassign"
  | "permissions"
  | "margin-simulator";

export interface NavItem {
  key: NavKey;
  label: string;
  href: string;
  icon: ReactNode;
  active?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const SIZE = 15;

// Every role lands on the role-neutral home "/", which renders their dashboard.
function dashboardHref(): string {
  return "/";
}

function rawSections(role: DashboardRole): NavSection[] {
  const overview: NavSection = {
    title: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", href: dashboardHref(), icon: <LayoutDashboard size={SIZE} /> },
    ],
  };

  if (role === "SUPER_ADMIN") {
    return [
      overview,
      {
        title: "Management",
        items: [
          { key: "customers", label: "Customers", href: "/customers", icon: <Users size={SIZE} /> },
          { key: "orders", label: "Orders", href: "/orders", icon: <ShoppingCart size={SIZE} /> },
          { key: "products", label: "Products", href: "/products", icon: <Package size={SIZE} /> },
          { key: "stock", label: "Stock Journal", href: "/stock", icon: <Boxes size={SIZE} /> },
          { key: "invoices", label: "Invoices", href: "/invoices", icon: <FileText size={SIZE} /> },
          { key: "collections", label: "Collections", href: "/collections", icon: <Banknote size={SIZE} /> },
          { key: "expenditures", label: "Expenditure", href: "/expenditures", icon: <Wallet size={SIZE} /> },
          { key: "alerts", label: "Alerts", href: "/alerts", icon: <AlertCircle size={SIZE} /> },
          { key: "tasks", label: "Tasks", href: "/tasks", icon: <CheckSquare size={SIZE} /> },
          { key: "tracking", label: "Live Tracking", href: "/tracking", icon: <MapPin size={SIZE} /> },
          { key: "attendance", label: "Attendance", href: "/attendance", icon: <CalendarCheck size={SIZE} /> },
          { key: "logistics", label: "Logistics", href: "/logistics", icon: <Truck size={SIZE} /> },
          { key: "market-intelligence", label: "Market Intelligence", href: "/market-intelligence", icon: <Lightbulb size={SIZE} /> },
          { key: "reports", label: "Reports", href: "/reports", icon: <BarChart3 size={SIZE} /> },
          { key: "audit-logs", label: "Audit Logs", href: "/audit-logs", icon: <ScrollText size={SIZE} /> },
          { key: "errors", label: "Error Monitor", href: "/errors", icon: <Bug size={SIZE} /> },
        ],
      },
      {
        title: "Configure",
        items: [
          // Invoicing hidden from prod (2026-09-11): nav link removed; /invoicing page still works by URL.
          // { key: "invoicing", label: "Invoicing", href: "/invoicing", icon: <ScrollText size={SIZE} /> },
          { key: "targets", label: "Targets", href: "/targets", icon: <Target size={SIZE} /> },
          { key: "beat-plans", label: "Beat Plans", href: "/beat-plans", icon: <Route size={SIZE} /> },
          { key: "users-teams", label: "Users", href: "/settings/users", icon: <UserCog size={SIZE} /> },
          { key: "reassign", label: "Reassign Customers", href: "/reassign", icon: <ArrowRightLeft size={SIZE} /> },
          { key: "permissions", label: "Permissions", href: "/permissions", icon: <ShieldCheck size={SIZE} /> },
          { key: "margin-simulator", label: "Margin Simulator", href: "/margin-simulator", icon: <Calculator size={SIZE} /> },
          { key: "incentives", label: "Incentives", href: "/incentives", icon: <Award size={SIZE} /> },
        ],
      },
    ];
  }

  if (role === "MANAGER") {
    return [
      overview,
      {
        title: "Management",
        items: [
          { key: "customers", label: "Customers", href: "/customers", icon: <Users size={SIZE} /> },
          { key: "orders", label: "Orders", href: "/orders", icon: <ShoppingCart size={SIZE} /> },
          { key: "products", label: "Products", href: "/products", icon: <Package size={SIZE} /> },
          { key: "stock", label: "Stock Journal", href: "/stock", icon: <Boxes size={SIZE} /> },
          { key: "collections", label: "Collections", href: "/collections", icon: <Banknote size={SIZE} /> },
          { key: "expenditures", label: "Expenditure", href: "/expenditures", icon: <Wallet size={SIZE} /> },
          { key: "alerts", label: "Alerts", href: "/alerts", icon: <AlertCircle size={SIZE} /> },
          { key: "tasks", label: "Tasks", href: "/tasks", icon: <CheckSquare size={SIZE} /> },
          { key: "tracking", label: "Live Tracking", href: "/tracking", icon: <MapPin size={SIZE} /> },
          { key: "attendance", label: "Attendance", href: "/attendance", icon: <CalendarCheck size={SIZE} /> },
          { key: "logistics", label: "Logistics", href: "/logistics", icon: <Truck size={SIZE} /> },
          { key: "market-intelligence", label: "Market Intelligence", href: "/market-intelligence", icon: <Lightbulb size={SIZE} /> },
          { key: "invoices", label: "Invoices", href: "/invoices", icon: <FileText size={SIZE} /> },
          { key: "reports", label: "Reports", href: "/reports", icon: <BarChart3 size={SIZE} /> },
        ],
      },
      {
        title: "Configure",
        items: [
          { key: "targets", label: "Targets", href: "/targets", icon: <Target size={SIZE} /> },
          { key: "beat-plans", label: "Beat Plans", href: "/beat-plans", icon: <Route size={SIZE} /> },
          { key: "incentives", label: "Incentives", href: "/incentives", icon: <Award size={SIZE} /> },
        ],
      },
    ];
  }

  // ACCOUNTANT
  return [
    overview,
    {
      title: "Finance",
      items: [
        { key: "customers", label: "Customers", href: "/customers", icon: <Users size={SIZE} /> },
        { key: "orders", label: "Orders", href: "/orders", icon: <ShoppingCart size={SIZE} /> },
        { key: "products", label: "Products", href: "/products", icon: <Package size={SIZE} /> },
        { key: "stock", label: "Stock Journal", href: "/stock", icon: <Boxes size={SIZE} /> },
        { key: "invoices", label: "Invoices", href: "/invoices", icon: <FileText size={SIZE} /> },
        { key: "collections", label: "Collections", href: "/collections", icon: <Banknote size={SIZE} /> },
        { key: "expenditures", label: "Expenditure", href: "/expenditures", icon: <Wallet size={SIZE} /> },
        { key: "incentives", label: "Incentives", href: "/incentives", icon: <Award size={SIZE} /> },
        { key: "logistics", label: "Logistics", href: "/logistics", icon: <Truck size={SIZE} /> },
        { key: "attendance", label: "Attendance", href: "/attendance", icon: <CalendarCheck size={SIZE} /> },
        { key: "tasks", label: "Tasks", href: "/tasks", icon: <CheckSquare size={SIZE} /> },
        { key: "reports", label: "Reports", href: "/reports", icon: <BarChart3 size={SIZE} /> },
        // Not in the Accountant default set — each appears only when SA grants it via Permissions.
        { key: "alerts", label: "Alerts", href: "/alerts", icon: <AlertCircle size={SIZE} /> },
        { key: "tracking", label: "Live Tracking", href: "/tracking", icon: <MapPin size={SIZE} /> },
        { key: "market-intelligence", label: "Market Intelligence", href: "/market-intelligence", icon: <Lightbulb size={SIZE} /> },
        { key: "targets", label: "Targets", href: "/targets", icon: <Target size={SIZE} /> },
        { key: "beat-plans", label: "Beat Plans", href: "/beat-plans", icon: <Route size={SIZE} /> },
      ],
    },
  ];
}

/** Build the sidebar sections for a role, marking `active` (if given) as the current item. */
export function buildNavSections(role: DashboardRole, active?: NavKey): NavSection[] {
  return rawSections(role).map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.key === active ? { ...item, active: true } : item,
    ),
  }));
}
