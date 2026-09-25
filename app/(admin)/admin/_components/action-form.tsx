"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** Asks for confirmation before submitting (destructive actions). */
  confirm?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * <form> for admin Server Actions: disables its fieldset while pending and
 * shows the action's `{ error }` inline instead of throwing to an error page.
 */
export function ActionForm({ action, confirm, className, children }: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state?.error && (
        <p role="alert" className="basis-full text-sm text-red-500">
          {state.error}
        </p>
      )}
    </form>
  );
}
