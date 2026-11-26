// FarmFlow Design System Constants

export const COLORS = {
  primary: '#079B50',
  primaryDark: '#067A3F',
  primaryLight: '#E9F8EF',
  sidebar: '#092F2B',
  sidebarHover: '#0D3F38',
  sidebarActive: '#079B50',
  orange: '#F59E0B',
  orangeLight: '#FEF3C7',
  background: '#F7F9FA',
  white: '#FFFFFF',
  text: '#17212B',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  purple: '#8B5CF6',
  purpleLight: '#EDE9FE',
  blueLight: '#EFF6FF',
} as const;

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Hen Dispatch', href: '/dispatch', icon: 'Truck' },
  { label: 'Retail Sales', href: '/sales', icon: 'ShoppingCart' },
  { label: 'Expenses', href: '/expenses', icon: 'Receipt' },
  { label: 'Branches', href: '/branches', icon: 'Building2' },
  { label: 'Reports', href: '/reports', icon: 'BarChart3' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
] as const;

export const EXPENSE_CATEGORIES = [
  'Employee Salary',
  'Electricity',
  'Transport',
  'Rent',
  'Water',
  'Maintenance',
  'Packaging',
  'Miscellaneous',
] as const;

export const PAYMENT_METHODS = [
  'Cash',
  'UPI',
  'Bank Transfer',
  'Other',
] as const;

export const DISPATCH_STATUSES = [
  'Pending',
  'Received',
  'Cancelled',
] as const;

export const DATE_FILTERS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: '7days' },
  { label: 'Last 30 Days', value: '30days' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Custom', value: 'custom' },
] as const;

export const USER_ROLES = {
  OWNER: 'OWNER',
  BRANCH_MANAGER: 'BRANCH_MANAGER',
  SALES_EMPLOYEE: 'SALES_EMPLOYEE',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
