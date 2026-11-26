"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Tags, CheckCircle2, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createExpenseCategoryAction,
  toggleExpenseCategoryAction,
} from "@/server/actions/expense.actions";
import type { ExpenseCategoryDTO } from "@/server/services/expense.service";

interface ExpenseCategoriesPanelProps {
  categories: ExpenseCategoryDTO[];
  onCategoryChange: (updated: ExpenseCategoryDTO) => void;
  onNotify: (type: "success" | "error", message: string) => void;
}

export function ExpenseCategoriesPanel({
  categories,
  onCategoryChange,
  onNotify,
}: ExpenseCategoriesPanelProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setFormError("Category name must be at least 2 characters.");
      return;
    }

    startTransition(async () => {
      const res = await createExpenseCategoryAction({ name: trimmed });
      if (!res.success || !res.data) {
        setFormError(res.error ?? "Failed to create category.");
        return;
      }
      onCategoryChange(res.data);
      setName("");
      onNotify("success", `Category "${res.data.name}" is ready to use.`);
      router.refresh();
    });
  };

  const handleToggle = (category: ExpenseCategoryDTO) => {
    startTransition(async () => {
      const res = await toggleExpenseCategoryAction({
        id: category.id,
        isActive: !category.isActive,
      });
      if (!res.success || !res.data) {
        onNotify("error", res.error ?? "Unable to update category.");
        return;
      }
      onCategoryChange(res.data);
      onNotify(
        "success",
        `Category "${res.data.name}" ${res.data.isActive ? "enabled" : "disabled"}.`
      );
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold text-[#17212B]">
            Add Custom Category
          </CardTitle>
          <p className="text-sm text-gray-500">
            Create categories specific to your shops (e.g. Ice Blocks, Petrol,
            Knife Sharpening).
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleCreate}
            className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-start"
          >
            <div className="flex-1 space-y-1">
              <Input
                placeholder="Enter category name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="New category name"
              />
              {formError && <p className="text-sm text-red-600">{formError}</p>}
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={isPending}
              className="h-12 px-6 text-base font-semibold cursor-pointer"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold text-[#17212B] flex items-center gap-2">
            <Tags className="h-5 w-5 text-[#079B50]" />
            <span>Expense Categories ({categories.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-semibold text-[#17212B]">
                      {cat.name}
                    </span>
                    {cat.isDefault && (
                      <Badge variant="outline" className="text-xs">
                        Default
                      </Badge>
                    )}
                    <Badge
                      variant="secondary"
                      className={
                        cat.isActive
                          ? "bg-[#E9F8EF] text-[#079B50] border border-[#079B50]/20"
                          : "bg-gray-100 text-gray-600"
                      }
                    >
                      {cat.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {cat.expenseCount}{" "}
                    {cat.expenseCount === 1 ? "recorded entry" : "recorded entries"}
                  </p>
                </div>

                {!cat.isDefault && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleToggle(cat)}
                    className="self-start sm:self-auto cursor-pointer"
                  >
                    {cat.isActive ? (
                      <>
                        <Ban className="mr-1.5 h-4 w-4 text-gray-500" />
                        Disable
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-1.5 h-4 w-4 text-[#079B50]" />
                        Enable
                      </>
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
