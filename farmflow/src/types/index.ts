// FarmFlow Type Definitions

export type UserRole = 'OWNER' | 'BRANCH_MANAGER' | 'SALES_EMPLOYEE';

export type DispatchStatus = 'Pending' | 'Received' | 'Cancelled';

export type PaymentMethod = 'Cash' | 'UPI' | 'Bank Transfer' | 'Other';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  contactNumber?: string;
  managerId?: string;
  manager?: User;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface HenDispatch {
  id: string;
  dispatchDate: Date;
  supplierId: string;
  supplier?: Supplier;
  branchId: string;
  branch?: Branch;
  vehicleNumber?: string;
  numberOfJalis: number;
  birdsPerJali?: number;
  totalBirdCount: number;
  grossWeight: number;
  emptyJaliWeight: number;
  netWeight: number;
  purchaseRatePerKg: number;
  totalPurchaseAmount: number;
  status: DispatchStatus;
  notes?: string;
  createdById: string;
  createdBy?: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetailSale {
  id: string;
  saleDate: Date;
  branchId: string;
  branch?: Branch;
  sellingPricePerKg: number;
  totalWeightSold: number;
  numberOfBirdsSold: number;
  tokensIssued: number;
  salesAmount: number;
  cashReceived: number;
  upiReceived: number;
  otherPayment: number;
  totalPaymentReceived: number;
  difference: number;
  notes?: string;
  createdById: string;
  createdBy?: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface Expense {
  id: string;
  expenseDate: Date;
  branchId: string;
  branch?: Branch;
  categoryId: string;
  category?: ExpenseCategory;
  amount: number;
  paymentMethod: PaymentMethod;
  description?: string;
  createdById: string;
  createdBy?: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
}

export interface DailyClosing {
  id: string;
  closingDate: Date;
  branchId: string;
  branch?: Branch;
  openingBirdCount: number;
  birdsReceived: number;
  totalBirdsAvailable: number;
  birdsSold: number;
  deadDamagedBirds: number;
  otherAdjustments: number;
  expectedClosingBirdCount: number;
  actualClosingBirdCount: number;
  birdDifference: number;
  openingWeight: number;
  weightReceived: number;
  weightSold: number;
  expectedClosingWeight: number;
  actualClosingWeight: number;
  weightDifference: number;
  totalSales: number;
  totalCash: number;
  totalUpi: number;
  totalExpenses: number;
  expectedCashBalance: number;
  actualCashBalance: number;
  cashDifference: number;
  isClosed: boolean;
  closedById?: string;
  closedBy?: User;
  closedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardSummary {
  totalSales: number;
  purchaseCost: number;
  expenses: number;
  netProfit: number;
  salesChange?: number;
  purchaseChange?: number;
  expensesChange?: number;
  profitChange?: number;
}

export interface BranchOverview {
  branchId: string;
  branchName: string;
  totalSales: number;
  expenses: number;
  netProfit: number;
}

export interface TodaySnapshot {
  birdsSold: number;
  weightSold: number;
  avgSellingPrice: number;
  tokensIssued: number;
  remainingStock: number;
}

export interface SalesTrend {
  date: string;
  sales: number;
  profit: number;
}

export interface StockMovement {
  id: string;
  date: Date;
  branchId: string;
  movementType: 'DISPATCH_IN' | 'SALE_OUT' | 'DEAD_DAMAGED' | 'ADJUSTMENT';
  birdCount: number;
  weight: number;
  referenceId?: string;
  referenceType?: string;
  notes?: string;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  userId: string;
  user?: User;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  createdAt: Date;
}
