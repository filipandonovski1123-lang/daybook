import { Download, FileText, ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, ConfirmDialog, Dialog, Input, Select } from '../../components/ui';
import { addEvidence, deleteEvidence, evidenceBlob, MAX_FILE_BYTES, updateEvidence } from '../../db/actions';
import type { Challenge, EvidenceMeta } from '../../domain/types';
import { errorMessage, useApp } from '../../lib/appData';
import { useToast } from '../../lib/toast';

/** Object URL for a stored file, revoked on unmount. Bytes are loaded lazily per file. */
function useEvidenceUrl(meta: EvidenceMeta | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const id = meta?.id;
  const mime = meta?.mime;
  useEffect(() => {
    if (!id || !mime) return;
    let u: string | null = null;
    let cancelled = false;
    void evidenceBlob(id, mime).then((b) => {
      if (cancelled || !b) return;
      u = URL.createObjectURL(b);
      setUrl(u);
    });
    return () => {
      cancelled = true;
      if (u) URL.revokeObjectURL(u);
    };
  }, [id, mime]);
  return url;
}

export function EvidenceGallery({ challenge }: { challenge: Challenge }) {
  const { data } = useApp();
  const toast = useToast();
  const items = data.evidence.filter((e) => e.challengeId === challenge.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const tags = challenge.evidence.tags ?? [];
  const usedTags = new Set(items.map((i) => i.tag));
  const [tag, setTag] = useState<string>(() => tags.find((t) => !usedTags.has(t)) ?? tags[0] ?? '');
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<EvidenceMeta | null>(null);
  const [toDelete, setToDelete] = useState<EvidenceMeta | null>(null);
  const full = challenge.evidence.max !== undefined && items.length >= challenge.evidence.max;

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let ok = 0;
    for (const f of Array.from(files)) {
      try {
        await addEvidence(challenge.id, f, tag || null);
        ok++;
      } catch (e) {
        toast.show(errorMessage(e), { tone: 'error' });
      }
    }
    setBusy(false);
    if (ok) toast.show(`${ok} file${ok > 1 ? 's' : ''} saved on this device.`);
    if (inputRef.current) inputRef.current.value = '';
    const next = tags.find((t) => !usedTags.has(t) && t !== tag);
    if (next) setTag(next);
  };

  const before = items.find((i) => i.tag === 'before' && i.mime.startsWith('image/'));
  const after = items.find((i) => i.tag === 'after' && i.mime.startsWith('image/'));

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        {tags.length > 0 && (
          <div className="w-44">
            <label className="mb-1.5 block text-[13px] font-medium text-ink-2" htmlFor={`tag-${challenge.id}`}>
              Tag
            </label>
            <Select id={`tag-${challenge.id}`} value={tag} onChange={(e) => setTag(e.target.value)}>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                  {usedTags.has(t) ? ' ✓' : ''}
                </option>
              ))}
            </Select>
          </div>
        )}
        <input ref={inputRef} type="file" className="sr-only" id={`file-${challenge.id}`} accept={challenge.evidence.accept} multiple={!full} onChange={(e) => void upload(e.target.files)} disabled={busy || full} />
        <Button icon={<ImagePlus className="size-4" />} busy={busy} disabled={full} onClick={() => inputRef.current?.click()}>
          Add files
        </Button>
        <p className="pb-2 text-xs text-ink-3">
          {challenge.evidence.max ? `${items.length}/${challenge.evidence.max} · ` : ''}Max {MAX_FILE_BYTES / 1024 / 1024} MB each · stored only on this device
        </p>
      </div>

      {before && after && <BeforeAfter before={before} after={after} />}

      {items.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {items.map((it) => (
            <EvidenceTile key={it.id} item={it} onOpen={() => setViewing(it)} onDelete={() => setToDelete(it)} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-3">No files yet.</p>
      )}

      <EvidenceViewer item={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Delete this file?"
        tone="danger"
        confirmLabel="Delete"
        onConfirm={() => {
          const t = toDelete;
          setToDelete(null);
          if (t) void deleteEvidence(t.id).then(() => toast.show('File deleted.'), (e: unknown) => toast.show(errorMessage(e), { tone: 'error' }));
        }}
      >
        “{toDelete?.name}” will be removed from this device. This can’t be undone unless you have an export that includes files.
      </ConfirmDialog>
    </div>
  );
}

function EvidenceTile({ item, onOpen, onDelete }: { item: EvidenceMeta; onOpen: () => void; onDelete: () => void }) {
  const isImage = item.mime.startsWith('image/');
  const url = useEvidenceUrl(isImage ? item : null);
  return (
    <li className="group relative overflow-hidden rounded-xl border border-line bg-surface-2">
      <button type="button" onClick={onOpen} className="block aspect-[4/3] w-full" aria-label={`Open ${item.name}`}>
        {isImage && url ? (
          <img src={url} alt={item.caption || item.name} className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1.5 p-2 text-ink-3">
            <FileText className="size-6" aria-hidden />
            <span className="line-clamp-2 break-all text-center text-[11px]">{item.name}</span>
          </span>
        )}
      </button>
      {item.tag && (
        <Badge className="absolute left-1.5 top-1.5" tone="neutral">
          {item.tag}
        </Badge>
      )}
      <button type="button" onClick={onDelete} aria-label={`Delete ${item.name}`} className="absolute right-1.5 top-1.5 rounded-md bg-black/55 p-1 text-white opacity-100 transition-opacity hover:bg-danger md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100">
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}

function EvidenceViewer({ item, onClose }: { item: EvidenceMeta | null; onClose: () => void }) {
  const url = useEvidenceUrl(item);
  if (!item) return null;
  return <ViewerBody key={item.id} item={item} url={url} onClose={onClose} />;
}

function ViewerBody({ item, url, onClose }: { item: EvidenceMeta; url: string | null; onClose: () => void }) {
  const [caption, setCaption] = useState(item.caption);
  const kind = item.mime.split('/')[0];
  return (
    <Dialog open={!!item} onClose={onClose} title={item.name} size="lg">
      <div className="overflow-hidden rounded-xl bg-black/30">
        {url && kind === 'image' && <img src={url} alt={item.caption || item.name} className="mx-auto max-h-[60dvh] w-auto object-contain" />}
        {url && kind === 'video' && <video src={url} controls className="mx-auto max-h-[60dvh] w-full" />}
        {url && kind === 'audio' && <audio src={url} controls className="w-full p-4" />}
        {url && !['image', 'video', 'audio'].includes(kind ?? '') && (
          <div className="p-6 text-center text-sm text-ink-2">
            <FileText className="mx-auto mb-2 size-8" aria-hidden /> Preview not available.
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input aria-label="Caption" value={caption} maxLength={500} placeholder="Add a caption" onChange={(e) => setCaption(e.target.value)} onBlur={() => caption !== item.caption && void updateEvidence(item.id, { caption })} className="flex-1" />
        {url && (
          <a href={url} download={item.name} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line bg-surface-2 px-4 text-sm font-medium hover:bg-surface-3">
            <Download className="size-4" /> Download
          </a>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-3">{(item.size / 1024 / 1024).toFixed(2)} MB · {item.mime}</p>
    </Dialog>
  );
}

function BeforeAfter({ before, after }: { before: EvidenceMeta; after: EvidenceMeta }) {
  const a = useEvidenceUrl(before);
  const b = useEvidenceUrl(after);
  const [pos, setPos] = useState(50);
  if (!a || !b) return null;
  return (
    <figure className="mt-4">
      <div className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-xl border border-line bg-black/40">
        <img src={b} alt="After" className="absolute inset-0 size-full object-contain" />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <img src={a} alt="Before" className="absolute inset-0 size-full object-contain" />
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow" style={{ left: `${pos}%` }} />
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">Before</span>
        <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">After</span>
      </div>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="mt-2 w-full accent-[var(--accent)]" aria-label="Compare before and after" />
      <figcaption className="sr-only">Before and after comparison</figcaption>
    </figure>
  );
}
