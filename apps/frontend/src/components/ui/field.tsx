import * as React from "react";

import { Label } from "@/components/ui/label";

type FieldProps = {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
};

/**
 * A labelled form field: a <Label> stacked over whatever input you nest inside.
 * Keeps every form in the app spaced and styled consistently.
 */
export function Field({ label, htmlFor, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-slate-900/70 text-sm font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}
