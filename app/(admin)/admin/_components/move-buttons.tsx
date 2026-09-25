import type { ActionState } from "@/lib/action-state";
import { ActionForm } from "./action-form";
import { iconButton } from "./ui";

type Props = {
  id: string;
  index: number;
  total: number;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
};

export function MoveButtons({ id, index, total, action }: Props) {
  return (
    <div className="flex gap-1">
      {(["up", "down"] as const).map((direction) => (
        <ActionForm key={direction} action={action}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="direction" value={direction} />
          <button
            type="submit"
            className={iconButton}
            aria-label={`Move ${direction}`}
            disabled={direction === "up" ? index === 0 : index === total - 1}
          >
            {direction === "up" ? "↑" : "↓"}
          </button>
        </ActionForm>
      ))}
    </div>
  );
}
