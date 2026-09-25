"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { KeepScale, TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { createRoute, deleteRoute, moveRoutePin, updateRoute } from "./actions";
import type { EditorGrade, EditorRoute, RouteFields } from "./types";
import { button, dangerButton, iconButton, input, primaryButton } from "../../../../_components/ui";

type Props = {
  photo: { id: string; url: string; width: number; height: number };
  initialRoutes: EditorRoute[];
  grades: EditorGrade[];
};

type Pin = { pinX: number; pinY: number };
type Draft = Pin & { fields: RouteFields };
type Selection = { kind: "route"; id: string } | { kind: "draft" } | null;

// Common hold colors beyond the grade colors, for gyms where hold color and
// grade color diverge.
const EXTRA_HOLD_COLORS = ["#f5f5f5", "#ec4899", "#f97316", "#14b8a6", "#78350f"];

/** A pointer that moves less than this (px) between down and up is a tap. */
const TAP_SLOP = 8;

function contrastText(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#171717" : "#ffffff";
}

function fieldsOf(route: EditorRoute): RouteFields {
  const { color, gradeId, pointsOverride, name, notes } = route;
  return { color, gradeId, pointsOverride, name, notes };
}

export function PinEditor({ photo, initialRoutes, grades }: Props) {
  const [routes, setRoutes] = useState(initialRoutes);
  const [selection, setSelection] = useState<Selection>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [form, setForm] = useState<RouteFields | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const imageBoxRef = useRef<HTMLDivElement>(null);
  const lastGradeId = useRef<string | null>(grades[0]?.id ?? null);
  const tap = useRef<{ x: number; y: number; multi: boolean } | null>(null);
  const activePointers = useRef(new Set<number>());
  const drag = useRef<{
    target: "draft" | string;
    x: number;
    y: number;
    moved: boolean;
    origin: Pin;
  } | null>(null);
  const suppressClick = useRef(false);

  const gradeById = useMemo(() => new Map(grades.map((g) => [g.id, g])), [grades]);

  // Numbered left-to-right, the way climbers scan a wall.
  const numbered = useMemo(
    () => [...routes].sort((a, b) => a.pinX - b.pinX),
    [routes]
  );

  const holdColors = useMemo(() => {
    const colors = grades.map((g) => g.colorHint).filter((c): c is string => !!c);
    return [...new Set([...colors, ...EXTRA_HOLD_COLORS])];
  }, [grades]);

  function pinFromPointer(clientX: number, clientY: number): Pin | null {
    const box = imageBoxRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    return {
      pinX: clamp((clientX - box.left) / box.width),
      pinY: clamp((clientY - box.top) / box.height),
    };
  }

  function defaultFields(): RouteFields {
    const grade = lastGradeId.current ? gradeById.get(lastGradeId.current) : undefined;
    return {
      color: grade?.colorHint ?? holdColors[0] ?? "#a855f7",
      gradeId: grade?.id ?? null,
      pointsOverride: null,
      name: null,
      notes: null,
    };
  }

  function select(next: Selection) {
    setError(null);
    setSelection(next);
    if (next?.kind === "route") {
      const route = routes.find((r) => r.id === next.id);
      setForm(route ? fieldsOf(route) : null);
      setDraft(null);
    } else if (next === null) {
      setForm(null);
      setDraft(null);
    }
  }

  // ------------------------------------------------ tap on photo → new pin

  function onImagePointerDown(e: React.PointerEvent) {
    activePointers.current.add(e.pointerId);
    if (activePointers.current.size === 1) {
      tap.current = { x: e.clientX, y: e.clientY, multi: false };
    } else if (tap.current) {
      tap.current.multi = true; // pinch, not a tap
    }
  }

  function onImagePointerUp(e: React.PointerEvent) {
    activePointers.current.delete(e.pointerId);
    const start = tap.current;
    if (!start || activePointers.current.size > 0) return;
    tap.current = null;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (start.multi || moved > TAP_SLOP) return; // it was a pan/pinch

    if (selection?.kind === "route") {
      select(null); // tapping away closes the panel first
      return;
    }
    const pin = pinFromPointer(e.clientX, e.clientY);
    if (!pin) return;
    setError(null);
    if (draft) {
      setDraft({ ...draft, ...pin });
    } else {
      const fields = defaultFields();
      setDraft({ ...pin, fields });
      setForm(fields);
      setSelection({ kind: "draft" });
    }
  }

  function onImagePointerCancel(e: React.PointerEvent) {
    activePointers.current.delete(e.pointerId);
    tap.current = null;
  }

  // ------------------------------------------------- drag a pin to move it

  function onPinPointerDown(e: React.PointerEvent, target: "draft" | string, origin: Pin) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { target, x: e.clientX, y: e.clientY, moved: false, origin };
  }

  function onPinPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < TAP_SLOP) return;
    d.moved = true;
    const pin = pinFromPointer(e.clientX, e.clientY);
    if (!pin) return;
    if (d.target === "draft") {
      setDraft((prev) => (prev ? { ...prev, ...pin } : prev));
    } else {
      setRoutes((prev) => prev.map((r) => (r.id === d.target ? { ...r, ...pin } : r)));
    }
  }

  function onPinPointerUp(e: React.PointerEvent) {
    e.stopPropagation();
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    suppressClick.current = true;
    if (d.target === "draft") return; // persisted on Save

    const routeId = d.target;
    const pin = pinFromPointer(e.clientX, e.clientY);
    if (!pin) return;
    startTransition(async () => {
      const result = await moveRoutePin(routeId, pin);
      if ("error" in result) {
        setError(result.error);
        setRoutes((prev) =>
          prev.map((r) => (r.id === routeId ? { ...r, ...d.origin } : r))
        );
      }
    });
  }

  function onPinClick(target: "draft" | string) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (target !== "draft") select({ kind: "route", id: target });
  }

  // ------------------------------------------------------- side panel

  function setGrade(gradeId: string | null) {
    if (!form) return;
    const prevHint = form.gradeId ? gradeById.get(form.gradeId)?.colorHint : null;
    const nextHint = gradeId ? gradeById.get(gradeId)?.colorHint : null;
    // Follow the grade's color unless the hold color was set independently.
    const color = nextHint && (!prevHint || form.color === prevHint) ? nextHint : form.color;
    setForm({ ...form, gradeId, color });
    if (draft) setDraft({ ...draft, fields: { ...draft.fields, gradeId, color } });
  }

  function setField<K extends keyof RouteFields>(key: K, value: RouteFields[K]) {
    if (!form) return;
    setForm({ ...form, [key]: value });
    if (key === "color" && draft) {
      setDraft({ ...draft, fields: { ...draft.fields, color: value as string } });
    }
  }

  function save() {
    if (!form) return;
    setError(null);
    startTransition(async () => {
      if (selection?.kind === "draft" && draft) {
        const result = await createRoute(photo.id, draft, form);
        if ("error" in result) return setError(result.error);
        lastGradeId.current = result.route.gradeId ?? lastGradeId.current;
        setRoutes((prev) => [...prev, result.route]);
        setDraft(null);
        setSelection(null);
        setForm(null);
      } else if (selection?.kind === "route") {
        const result = await updateRoute(selection.id, form);
        if ("error" in result) return setError(result.error);
        lastGradeId.current = result.route.gradeId ?? lastGradeId.current;
        setRoutes((prev) => prev.map((r) => (r.id === result.route.id ? result.route : r)));
        setSelection(null);
        setForm(null);
      }
    });
  }

  function remove() {
    if (selection?.kind !== "route") return;
    if (!window.confirm("Delete this route?")) return;
    const routeId = selection.id;
    startTransition(async () => {
      const result = await deleteRoute(routeId);
      if (result.error) return setError(result.error);
      setRoutes((prev) => prev.filter((r) => r.id !== routeId));
      select(null);
    });
  }

  const selectedGrade = form?.gradeId ? gradeById.get(form.gradeId) : undefined;

  // ------------------------------------------------------------ render

  function renderPin(target: "draft" | string, pin: Pin, color: string, label: string, active: boolean) {
    return (
      <div
        key={target}
        className="pin absolute h-0 w-0"
        style={{ left: `${pin.pinX * 100}%`, top: `${pin.pinY * 100}%` }}
      >
        <KeepScale className="h-0 w-0">
          <button
            type="button"
            aria-label={target === "draft" ? "New route" : `Route ${label}`}
            onPointerDown={(e) => onPinPointerDown(e, target, pin)}
            onPointerMove={onPinPointerMove}
            onPointerUp={onPinPointerUp}
            onClick={() => onPinClick(target)}
            className={`absolute left-0 top-0 flex size-8 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-full border-2 text-xs font-bold shadow-lg active:cursor-grabbing ${
              active ? "border-white ring-4 ring-purple-500" : "border-white/90"
            } ${target === "draft" ? "border-dashed" : ""}`}
            style={{ backgroundColor: color, color: contrastText(color) }}
          >
            {label}
          </button>
        </KeepScale>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <TransformWrapper
          minScale={1}
          maxScale={8}
          doubleClick={{ disabled: true }}
          panning={{ excluded: ["pin"] }}
          pinch={{ excluded: ["pin"] }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <div className="relative overflow-hidden rounded-lg bg-black">
              <TransformComponent
                // Shrinks to the photo's aspect ratio (no letterboxing a landscape
                // shot on a phone), capped so tall photos still fit the screen.
                wrapperStyle={{
                  width: "100%",
                  aspectRatio: `${photo.width} / ${photo.height}`,
                  maxHeight: "min(70vh, 720px)",
                }}
                contentStyle={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  ref={imageBoxRef}
                  className="relative"
                  style={{
                    aspectRatio: `${photo.width} / ${photo.height}`,
                    maxWidth: "100%",
                    maxHeight: "min(70vh, 720px)",
                    // Fill whichever dimension binds first.
                    width: `min(100%, calc(min(70vh, 720px) * ${photo.width / photo.height}))`,
                  }}
                  onPointerDown={onImagePointerDown}
                  onPointerUp={onImagePointerUp}
                  onPointerCancel={onImagePointerCancel}
                >
                  {/* Pre-sized WebP from Supabase Storage (PLAN §6), not next/image. */}
                  <img
                    src={photo.url}
                    alt=""
                    draggable={false}
                    className="block h-full w-full select-none"
                  />
                  {numbered.map((route, i) =>
                    renderPin(
                      route.id,
                      route,
                      route.color,
                      String(i + 1),
                      selection?.kind === "route" && selection.id === route.id
                    )
                  )}
                  {draft && renderPin("draft", draft, draft.fields.color, "+", true)}
                </div>
              </TransformComponent>
              <div className="absolute right-2 top-2 flex gap-1">
                <button type="button" className={`${iconButton} bg-black/60 text-white`} onClick={() => zoomIn()}>
                  +
                </button>
                <button type="button" className={`${iconButton} bg-black/60 text-white`} onClick={() => zoomOut()}>
                  −
                </button>
                <button type="button" className={`${iconButton} bg-black/60 text-white`} onClick={() => resetTransform()}>
                  Fit
                </button>
              </div>
            </div>
          )}
        </TransformWrapper>
        <p className="text-sm text-zinc-500">
          Tap the photo to drop a pin · drag a pin to move it · tap a pin to edit ·
          pinch or scroll to zoom.
        </p>
      </div>

      <aside className="flex w-full flex-col gap-4 lg:sticky lg:top-4 lg:w-80">
        {form ? (
          <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15">
            <h3 className="font-semibold">
              {selection?.kind === "draft"
                ? "New route"
                : `Route ${numbered.findIndex((r) => selection?.kind === "route" && r.id === selection.id) + 1}`}
            </h3>

            <label className="flex flex-col gap-1 text-sm">
              Grade
              <select
                className={input}
                value={form.gradeId ?? ""}
                onChange={(e) => setGrade(e.target.value || null)}
              >
                <option value="">— none —</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label} · {g.defaultPoints} pts
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1 text-sm">
              Hold color
              <div className="flex flex-wrap items-center gap-2">
                {holdColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => setField("color", c)}
                    className={`size-7 rounded-full border-2 ${
                      form.color.toLowerCase() === c.toLowerCase()
                        ? "border-purple-500 ring-2 ring-purple-500"
                        : "border-black/20 dark:border-white/30"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  aria-label="Custom color"
                  value={form.color}
                  onChange={(e) => setField("color", e.target.value)}
                  className="h-7 w-9 cursor-pointer rounded border border-black/15 bg-transparent dark:border-white/20"
                />
              </div>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              Points override
              <input
                type="number"
                min={0}
                className={input}
                placeholder={
                  selectedGrade ? `${selectedGrade.defaultPoints} (grade default)` : "0"
                }
                value={form.pointsOverride ?? ""}
                onChange={(e) =>
                  setField("pointsOverride", e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Name
              <input
                className={input}
                placeholder="Optional"
                value={form.name ?? ""}
                onChange={(e) => setField("name", e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Notes
              <textarea
                rows={2}
                className={input}
                placeholder="Optional — start hold, beta, …"
                value={form.notes ?? ""}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </label>

            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" className={primaryButton} disabled={pending} onClick={save}>
                {pending ? "Saving…" : selection?.kind === "draft" ? "Add route" : "Save"}
              </button>
              <button type="button" className={button} disabled={pending} onClick={() => select(null)}>
                Cancel
              </button>
              {selection?.kind === "route" && (
                <button type="button" className={dangerButton} disabled={pending} onClick={remove}>
                  Delete
                </button>
              )}
            </div>
          </div>
        ) : (
          error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )
        )}

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-zinc-500">
            {routes.length} route{routes.length === 1 ? "" : "s"} on this photo
          </h3>
          <ul className="flex flex-col gap-1">
            {numbered.map((route, i) => {
              const grade = route.gradeId ? gradeById.get(route.gradeId) : undefined;
              const points = route.pointsOverride ?? grade?.defaultPoints ?? 0;
              return (
                <li key={route.id}>
                  <button
                    type="button"
                    onClick={() => select({ kind: "route", id: route.id })}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ backgroundColor: route.color, color: contrastText(route.color) }}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate">
                      {route.name || grade?.label || "Ungraded"}
                    </span>
                    <span className="text-zinc-500">{points} pts</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
