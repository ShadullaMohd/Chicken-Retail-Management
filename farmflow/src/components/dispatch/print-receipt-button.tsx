"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintReceiptButton() {
  return (
    <Button
      type="button"
      size="lg"
      onClick={() => window.print()}
      className="h-11 text-base font-semibold cursor-pointer print:hidden"
    >
      <Printer className="mr-2 h-5 w-5" />
      Print Receipt
    </Button>
  );
}
