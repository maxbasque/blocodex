"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET } from "@/lib/photos";
import { createPhotoUpload, finalizePhotoUpload } from "../actions";
import { input, primaryButton } from "../../_components/ui";

type Props = {
  setId: string;
  walls: { id: string; name: string }[];
};

/**
 * Browser → Storage via a signed URL, then a Server Action runs sharp on it.
 * Files go one at a time so a failure names the file that broke.
 */
export function PhotoUploader({ setId, walls }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [wallId, setWallId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function upload() {
    const files = Array.from(fileRef.current?.files ?? []);
    if (files.length === 0) return;
    setErrors([]);

    startTransition(async () => {
      const supabase = createClient();
      const failed: string[] = [];
      for (const [i, file] of files.entries()) {
        setStatus(`Uploading ${i + 1}/${files.length}: ${file.name}`);
        const ticket = await createPhotoUpload(setId);
        if ("error" in ticket) {
          failed.push(`${file.name}: ${ticket.error}`);
          continue;
        }
        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
        if (uploadError) {
          failed.push(`${file.name}: ${uploadError.message}`);
          continue;
        }
        setStatus(`Processing ${i + 1}/${files.length}: ${file.name}`);
        const result = await finalizePhotoUpload({
          setId,
          originalPath: ticket.path,
          wallId: wallId || null,
        });
        if (result.error) failed.push(`${file.name}: ${result.error}`);
      }
      setErrors(failed);
      setStatus(null);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          // Listing only these makes iOS transcode HEIC to JPEG on pick.
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={pending}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-black/5 file:px-3 file:py-2 dark:file:bg-white/10"
        />
        <select
          value={wallId}
          onChange={(e) => setWallId(e.target.value)}
          disabled={pending}
          aria-label="Wall"
          className={input}
        >
          <option value="">No wall</option>
          {walls.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <button type="button" className={primaryButton} disabled={pending} onClick={upload}>
          {pending ? "Uploading…" : "Upload photos"}
        </button>
      </div>
      {status && <p className="text-sm text-zinc-500">{status}</p>}
      {errors.map((e) => (
        <p key={e} role="alert" className="text-sm text-red-500">
          {e}
        </p>
      ))}
    </div>
  );
}
