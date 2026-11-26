"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Phone,
  UserCheck,
  Eye,
  Pencil,
  Power,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  branchFormSchema,
  type BranchFormValues,
} from "@/lib/validations/branch";
import {
  createBranchAction,
  updateBranchAction,
  toggleBranchStatusAction,
} from "@/server/actions/branch.actions";
import type {
  BranchDTO,
  ManagerOptionDTO,
} from "@/server/services/branch.service";

interface BranchesClientProps {
  initialBranches: BranchDTO[];
  managers: ManagerOptionDTO[];
  canManage: boolean;
}

type StatusFilter = "all" | "active" | "inactive";

export function BranchesClient({
  initialBranches,
  managers,
  canManage,
}: BranchesClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchDTO | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<BranchDTO | null>(
    null
  );
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isToggling, startToggleTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: {
      name: "",
      code: "",
      address: "",
      contactNumber: "",
      managerId: "none",
      isActive: true,
    },
  });

  const stats = useMemo(() => {
    const total = initialBranches.length;
    const active = initialBranches.filter((b) => b.isActive).length;
    return { total, active, inactive: total - active };
  }, [initialBranches]);

  const filteredBranches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialBranches.filter((b) => {
      if (statusFilter === "active" && !b.isActive) return false;
      if (statusFilter === "inactive" && b.isActive) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        (b.address ?? "").toLowerCase().includes(q) ||
        (b.managerName ?? "").toLowerCase().includes(q)
      );
    });
  }, [initialBranches, search, statusFilter]);

  const openCreateModal = () => {
    setEditingBranch(null);
    setFormError(null);
    reset({
      name: "",
      code: "",
      address: "",
      contactNumber: "",
      managerId: "none",
      isActive: true,
    });
    setFormOpen(true);
  };

  const openEditModal = (branch: BranchDTO) => {
    setEditingBranch(branch);
    setFormError(null);
    reset({
      name: branch.name,
      code: branch.code,
      address: branch.address ?? "",
      contactNumber: branch.contactNumber ?? "",
      managerId: branch.managerId ?? "none",
      isActive: branch.isActive,
    });
    setFormOpen(true);
  };

  const onSubmit = async (values: BranchFormValues) => {
    setFormError(null);
    setFeedback(null);

    const result = editingBranch
      ? await updateBranchAction({ ...values, id: editingBranch.id })
      : await createBranchAction(values);

    if (!result.success) {
      setFormError(result.error ?? "Operation failed.");
      return;
    }

    setFormOpen(false);
    setFeedback({
      type: "success",
      message: editingBranch
        ? `Branch "${result.data?.name}" updated successfully.`
        : `Branch "${result.data?.name}" created successfully.`,
    });
    router.refresh();
  };

  const handleStatusToggle = (branch: BranchDTO, nextActive: boolean) => {
    setFeedback(null);
    startToggleTransition(async () => {
      const result = await toggleBranchStatusAction({
        id: branch.id,
        isActive: nextActive,
      });

      setDeactivateTarget(null);

      if (!result.success) {
        setFeedback({
          type: "error",
          message: result.error ?? "Failed to update branch status.",
        });
        return;
      }

      setFeedback({
        type: "success",
        message: nextActive
          ? `Branch "${branch.name}" activated.`
          : `Branch "${branch.name}" deactivated.`,
      });
      router.refresh();
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#17212B]">Branches</h2>
          <p className="text-base text-gray-500 mt-0.5">
            {canManage
              ? "Add and manage chicken retail shop locations"
              : "View your assigned chicken shop branch"}
          </p>
        </div>

        {canManage && (
          <Button
            type="button"
            size="lg"
            onClick={openCreateModal}
            className="h-12 text-base font-semibold cursor-pointer"
          >
            <Plus className="mr-2 h-5 w-5" />
            Add Branch
          </Button>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-base ${
            feedback.type === "success"
              ? "border-[#079B50]/30 bg-[#E9F8EF] text-[#092F2B]"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-[#079B50] shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-sm font-medium text-gray-500">Total Branches</p>
            <p className="text-2xl sm:text-3xl font-bold text-[#17212B] mt-1">
              {stats.total}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-sm font-medium text-gray-500">Active</p>
            <p className="text-2xl sm:text-3xl font-bold text-[#079B50] mt-1">
              {stats.active}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-sm font-medium text-gray-500">Inactive</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-600 mt-1">
              {stats.inactive}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Status Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by branch name, code, address, or manager..."
            className="pl-11 h-11 bg-white"
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val as StatusFilter)}
          >
            <SelectTrigger aria-label="Filter by status">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="inactive">Inactive Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Branch List */}
      {filteredBranches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-semibold text-[#17212B]">
              No branches found
            </p>
            <p className="text-base text-gray-500 mt-1">
              {search || statusFilter !== "all"
                ? "Try clearing your search or status filter."
                : "Add your first shop branch to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredBranches.map((branch) => (
              <Card key={branch.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-bold text-[#17212B]">
                        {branch.name}
                      </p>
                      <p className="text-sm font-mono text-gray-500">
                        {branch.code}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        branch.isActive
                          ? "bg-[#E9F8EF] text-[#079B50] border border-[#079B50]/20"
                          : "bg-gray-100 text-gray-600 border border-gray-200"
                      }
                    >
                      {branch.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-sm text-gray-600 pt-1 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                      <span>{branch.address || "No address provided"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                      <span>{branch.contactNumber || "No contact number"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-gray-400 shrink-0" />
                      <span>
                        Manager: {branch.managerName ?? "Unassigned"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="flex-1 h-10 text-sm"
                    >
                      <Link href={`/branches/${branch.id}`}>
                        <Eye className="mr-1.5 h-4 w-4" />
                        View
                      </Link>
                    </Button>
                    {canManage && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(branch)}
                          className="flex-1 h-10 text-sm cursor-pointer"
                        >
                          <Pencil className="mr-1.5 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isToggling}
                          onClick={() =>
                            branch.isActive
                              ? setDeactivateTarget(branch)
                              : handleStatusToggle(branch, true)
                          }
                          className="h-10 text-sm cursor-pointer"
                        >
                          <Power className="mr-1.5 h-4 w-4" />
                          {branch.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-base">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F7F9FA]">
                      <th className="text-left py-3.5 px-5 font-medium text-gray-500">
                        Branch Name
                      </th>
                      <th className="text-left py-3.5 px-4 font-medium text-gray-500">
                        Location
                      </th>
                      <th className="text-left py-3.5 px-4 font-medium text-gray-500">
                        Contact Number
                      </th>
                      <th className="text-left py-3.5 px-4 font-medium text-gray-500">
                        Manager
                      </th>
                      <th className="text-right py-3.5 px-4 font-medium text-gray-500">
                        Current Stock
                      </th>
                      <th className="text-center py-3.5 px-4 font-medium text-gray-500">
                        Status
                      </th>
                      <th className="text-right py-3.5 px-5 font-medium text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBranches.map((branch) => (
                      <tr
                        key={branch.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70"
                      >
                        <td className="py-4 px-5">
                          <p className="font-semibold text-[#17212B]">
                            {branch.name}
                          </p>
                          <p className="text-xs font-mono text-gray-500 mt-0.5">
                            {branch.code}
                          </p>
                        </td>
                        <td className="py-4 px-4 text-gray-600 max-w-xs">
                          {branch.address || "—"}
                        </td>
                        <td className="py-4 px-4 text-[#17212B]">
                          {branch.contactNumber || "—"}
                        </td>
                        <td className="py-4 px-4 text-[#17212B]">
                          {branch.managerName ?? (
                            <span className="text-gray-400">Unassigned</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right text-[#17212B]">
                          <span className="font-semibold">
                            {branch.currentBirdStock}
                          </span>{" "}
                          birds
                          <span className="text-gray-500 block text-xs">
                            {branch.currentWeightStock.toFixed(2)} kg
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Badge
                            variant="secondary"
                            className={
                              branch.isActive
                                ? "bg-[#E9F8EF] text-[#079B50] border border-[#079B50]/20"
                                : "bg-gray-100 text-gray-600 border border-gray-200"
                            }
                          >
                            {branch.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/branches/${branch.id}`}>
                                <Eye className="mr-1.5 h-4 w-4" />
                                View
                              </Link>
                            </Button>
                            {canManage && (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditModal(branch)}
                                  className="cursor-pointer"
                                >
                                  <Pencil className="mr-1.5 h-4 w-4" />
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={isToggling}
                                  onClick={() =>
                                    branch.isActive
                                      ? setDeactivateTarget(branch)
                                      : handleStatusToggle(branch, true)
                                  }
                                  className="cursor-pointer"
                                >
                                  {branch.isActive ? "Deactivate" : "Activate"}
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Add / Edit Branch Modal */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBranch ? "Edit Branch" : "Add New Branch"}
            </DialogTitle>
            <DialogDescription>
              {editingBranch
                ? "Update branch contact details, assigned manager, or status."
                : "Create a new chicken retail shop branch."}
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="branch-name" className="text-base">
                  Branch Name *
                </Label>
                <Input
                  id="branch-name"
                  placeholder="e.g. East Market Shop"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="branch-code" className="text-base">
                  Branch Code *
                </Label>
                <Input
                  id="branch-code"
                  placeholder="e.g. BR-004"
                  className="uppercase"
                  {...register("code")}
                />
                {errors.code && (
                  <p className="text-sm text-red-600">{errors.code.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branch-contact" className="text-base">
                Contact Number
              </Label>
              <Input
                id="branch-contact"
                placeholder="+91 98765 43210"
                {...register("contactNumber")}
              />
              {errors.contactNumber && (
                <p className="text-sm text-red-600">
                  {errors.contactNumber.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branch-address" className="text-base">
                Address
              </Label>
              <Textarea
                id="branch-address"
                placeholder="Shop number, street, landmark..."
                {...register("address")}
              />
              {errors.address && (
                <p className="text-sm text-red-600">{errors.address.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-base">Branch Manager</Label>
                <Controller
                  control={control}
                  name="managerId"
                  render={({ field }) => (
                    <Select
                      value={field.value || "none"}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Manager" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {managers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-base">Status</Label>
                <Controller
                  control={control}
                  name="isActive"
                  render={({ field }) => (
                    <Select
                      value={field.value ? "active" : "inactive"}
                      onValueChange={(val) => field.onChange(val === "active")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setFormOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingBranch ? (
                  "Save Changes"
                ) : (
                  "Create Branch"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deactivate Branch Confirmation */}
      <AlertDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Branch?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{" "}
              <strong>{deactivateTarget?.name}</strong>? Historical records are
              preserved, and you can reactivate the branch anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isToggling}
              onClick={() => {
                if (deactivateTarget) {
                  handleStatusToggle(deactivateTarget, false);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
            >
              {isToggling ? "Deactivating..." : "Deactivate Branch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
