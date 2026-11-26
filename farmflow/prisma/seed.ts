import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_EXPENSE_CATEGORIES = [
  "Employee Salary",
  "Electricity",
  "Transport",
  "Rent",
  "Water",
  "Maintenance",
  "Packaging",
  "Miscellaneous",
];

async function main() {
  console.log("Seeding FarmFlow database...");

  // 1. Upsert Business
  const business = await prisma.business.upsert({
    where: { id: "default-business" },
    update: {},
    create: {
      id: "default-business",
      name: "FarmFlow Poultry Retail",
      address: "Head Office, Market Road",
      phone: "+91 98765 00000",
      email: "admin@farmflow.in",
      timezone: "Asia/Kolkata",
      currency: "INR",
      allowNegativeStock: false,
    },
  });

  // 2. Hash development passwords
  const ownerPassword = await bcrypt.hash("Owner@123", 12);
  const managerPassword = await bcrypt.hash("Manager@123", 12);
  const salesPassword = await bcrypt.hash("Sales@123", 12);

  // 3. Upsert Users
  const owner = await prisma.user.upsert({
    where: { email: "owner@farmflow.in" },
    update: {},
    create: {
      businessId: business.id,
      name: "Shadulla Khan",
      email: "owner@farmflow.in",
      passwordHash: ownerPassword,
      role: Role.OWNER,
      phone: "+91 98765 00001",
      isActive: true,
    },
  });

  const managerMain = await prisma.user.upsert({
    where: { email: "manager.main@farmflow.in" },
    update: {},
    create: {
      businessId: business.id,
      name: "Ramesh Nair",
      email: "manager.main@farmflow.in",
      passwordHash: managerPassword,
      role: Role.BRANCH_MANAGER,
      phone: "+91 98765 00002",
      isActive: true,
    },
  });

  const managerCity = await prisma.user.upsert({
    where: { email: "manager.city@farmflow.in" },
    update: {},
    create: {
      businessId: business.id,
      name: "Imran Sheikh",
      email: "manager.city@farmflow.in",
      passwordHash: managerPassword,
      role: Role.BRANCH_MANAGER,
      phone: "+91 98765 00003",
      isActive: true,
    },
  });

  const salesMain = await prisma.user.upsert({
    where: { email: "sales.main@farmflow.in" },
    update: {},
    create: {
      businessId: business.id,
      name: "Suresh Kumar",
      email: "sales.main@farmflow.in",
      passwordHash: salesPassword,
      role: Role.SALES_EMPLOYEE,
      phone: "+91 98765 00004",
      isActive: true,
    },
  });

  // 4. Upsert Branches
  const mainBranch = await prisma.branch.upsert({
    where: { code: "BR-001" },
    update: {},
    create: {
      businessId: business.id,
      name: "Main Branch",
      code: "BR-001",
      address: "12 Market Road, Central Plaza",
      contactNumber: "+91 98765 43210",
      managerId: managerMain.id,
      isActive: true,
    },
  });

  const cityBranch = await prisma.branch.upsert({
    where: { code: "BR-002" },
    update: {},
    create: {
      businessId: business.id,
      name: "City Center",
      code: "BR-002",
      address: "45 Station Avenue, City Center",
      contactNumber: "+91 98765 43211",
      managerId: managerCity.id,
      isActive: true,
    },
  });

  const highwayBranch = await prisma.branch.upsert({
    where: { code: "BR-003" },
    update: {},
    create: {
      businessId: business.id,
      name: "Highway Outlet",
      code: "BR-003",
      address: "NH-44 Bypass Junction",
      contactNumber: "+91 98765 43212",
      managerId: null,
      isActive: true,
    },
  });

  // 5. Assign Users to Branches (UserBranch)
  const assignments = [
    { userId: managerMain.id, branchId: mainBranch.id },
    { userId: managerCity.id, branchId: cityBranch.id },
    { userId: salesMain.id, branchId: mainBranch.id },
  ];

  for (const assignment of assignments) {
    await prisma.userBranch.upsert({
      where: {
        userId_branchId: {
          userId: assignment.userId,
          branchId: assignment.branchId,
        },
      },
      update: {},
      create: assignment,
    });
  }

  // 6. Seed Default Expense Categories
  for (const name of DEFAULT_EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: {
        businessId_name: {
          businessId: business.id,
          name,
        },
      },
      update: {},
      create: {
        businessId: business.id,
        name,
        isDefault: true,
        isActive: true,
      },
    });
  }

  // 7. Seed Initial Suppliers (if none exist)
  const existingSuppliers = await prisma.supplier.count({
    where: { businessId: business.id },
  });

  if (existingSuppliers === 0) {
    await prisma.supplier.createMany({
      data: [
        {
          businessId: business.id,
          name: "Raju Poultry Farm",
          phone: "+91 98450 11223",
          address: "Poultry Estate, East Highway",
          isActive: true,
        },
        {
          businessId: business.id,
          name: "Green Valley Farms",
          phone: "+91 98450 44556",
          address: "Green Valley Road, Sector 4",
          isActive: true,
        },
      ],
    });
  }

  console.log(
    `Seed complete: Business "${business.name}", Owner ${owner.email}, 3 branches (${mainBranch.code}, ${cityBranch.code}, ${highwayBranch.code}), ${DEFAULT_EXPENSE_CATEGORIES.length} expense categories.`
  );
}

main()
  .catch((error) => {
    console.error("Error seeding database:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
