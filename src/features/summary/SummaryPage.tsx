import { Award, Download, Flame, Mountain, Share2, Sparkles, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Scene } from '../../components/Scene';
import { Button, Card, EmptyState, Stat } from '../../components/ui';
import { formatDate } from '../../domain/dates';
import { elapsedProgramDates, pct } from '../../domain/stats';
import { programSummary, type ProgramSummary } from '../../domain/summary';
import type { EvidenceMeta } from '../../domain/types';
import { useApp } from '../../lib/appData';
import { useProgramView } from '../../lib/selectors';
import { useToast } from '../../lib/toast';
import { useEvidenceUrl } from '../challenges/EvidenceGallery';

/** The end-of-program recap. Available any time; it becomes the celebration once the last day passes. */
export function SummaryPage() {
  const { data, today } = useApp();
  const view = useProgramView();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const summary = useMemo(() => {
    if (!view) return null;
    return programSummary({
      challenges: data.challenges,
      progress: data.progress,
      attempts: data.attempts,
      habits: data.habits,
      entries: data.entries,
      reflections: data.reflections,
      dates: elapsedProgramDates(view.startDate, today, view.length),
      missed: view.counts.missed,
    });
  }, [data, today, view]);
  if (!view || !summary) return null;
  const finished = view.phase === 'after';
  const photos = data.evidence.filter((e) => e.mime.startsWith('image/')).slice(-8);

  const share = async () => {
    setBusy(true);
    try {
      const blob = await renderShareCard(summary, { length: view.length, start: view.startDate, end: view.endDate, name: data.settings.displayName, finished });
      const file = new File([blob], `${view.length}-day-challenge.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${view.length}-Day Challenge` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast.show('Summary image downloaded.');
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) toast.show('Couldn’t create the image. Try again.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="eyebrow">
        {view.length}-day challenge · {formatDate(view.startDate, 'dm')} – {formatDate(view.endDate, 'dm')}
      </p>
      <h1 className="font-display mt-3 text-[36px] leading-[1.06] md:text-[46px]">{finished ? 'You did it.' : 'Your journey so far.'}</h1>
      <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-ink-2">
        {finished
          ? `${summary.completed} of ${summary.total} challenges completed${summary.attempted ? `, ${summary.attempted} more honestly attempted` : ''}. Every number here comes from what you actually logged.`
          : `Day ${view.day} of ${view.length}. This becomes your end-of-program summary when the last day passes.`}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="primary" icon={'share' in navigator ? <Share2 className="size-4" /> : <Download className="size-4" />} busy={busy} onClick={() => void share()}>
          Share summary image
        </Button>
      </div>

      <Scene kind="coast" className="-mx-5 mt-7 h-[180px] md:mx-0 md:rounded-xl" />

      <Card className="relative -mt-8 mx-0 grid grid-cols-2 gap-x-4 gap-y-6 p-5 md:mx-4 md:grid-cols-4">
        <Stat label="Challenges completed" value={`${summary.completed}/${summary.total}`} sub={summary.attempted ? `${summary.attempted} attempted` : undefined} tone="success" />
        <Stat label="Personal bests" value={summary.pbs.length} />
        <Stat label="Longest streak" value={`${summary.longestStreak} d`} />
        <Stat label="Habit adherence" value={pct(summary.habitRate)} sub={summary.reflections ? `${summary.reflections} reflections` : undefined} />
      </Card>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {summary.hardestCompleted && (
          <Highlight icon={<Mountain className="size-4" />} label="Hardest challenge conquered">
            <Link to={`/challenges/${summary.hardestCompleted.id}`} className="hover:underline">
              Day {summary.hardestCompleted.day}: {summary.hardestCompleted.title}
            </Link>
          </Highlight>
        )}
        {summary.bestHabit && (
          <Highlight icon={<Flame className="size-4" />} label="Most consistent habit">
            {summary.bestHabit.name} · {Math.round(summary.bestHabit.rate * 100)}% of planned days
          </Highlight>
        )}
        {summary.pbs[0] && (
          <Highlight icon={<Trophy className="size-4" />} label="Biggest improvement">
            {summary.pbs[0].label}: {summary.pbs[0].previous} → {summary.pbs[0].value}
            {summary.pbs[0].unit ? ` ${summary.pbs[0].unit}` : ''} (+{Math.round(summary.pbs[0].improvementPct)}%)
          </Highlight>
        )}
        {summary.favouriteReflection && (
          <Highlight icon={<Sparkles className="size-4" />} label={`From your reflection on ${formatDate(summary.favouriteReflection.date, 'dm')}`}>
            <span className="font-display text-[17px] italic">“{(summary.favouriteReflection.takeaway || summary.favouriteReflection.proud || summary.favouriteReflection.entry || summary.favouriteReflection.improvement).slice(0, 220)}”</span>
          </Highlight>
        )}
      </div>

      {photos.length > 0 && (
        <section className="mt-10" aria-labelledby="photos-title">
          <h2 id="photos-title" className="font-display text-[20px]">
            Along the way
          </h2>
          <ul className="mt-3 grid grid-cols-4 gap-2">
            {photos.map((p) => (
              <Photo key={p.id} meta={p} />
            ))}
          </ul>
        </section>
      )}

      {summary.completed + summary.attempted === 0 && (
        <EmptyState icon={<Award className="size-5" />} title="Nothing logged yet">
          Finish your first challenge and this page starts filling in.
        </EmptyState>
      )}
    </div>
  );
}

function Highlight({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="flex items-center gap-1.5 text-[12px] text-ink-3">
        <span className="text-slate">{icon}</span>
        {label}
      </p>
      <p className="mt-1.5 text-[14.5px] leading-snug">{children}</p>
    </div>
  );
}

function Photo({ meta }: { meta: EvidenceMeta }) {
  const url = useEvidenceUrl(meta);
  return <li className="aspect-square overflow-hidden rounded-lg bg-surface-2">{url && <img src={url} alt={meta.caption || ''} className="size-full object-cover" loading="lazy" />}</li>;
}

// ---------------------------------------------------------------- share image

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

/** A 1080×1350 portrait card in the app's editorial style. */
async function renderShareCard(s: ProgramSummary, o: { length: number; start: string; end: string; name: string; finished: boolean }): Promise<Blob> {
  await document.fonts?.ready;
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas');
  const serif = '"Newsreader Variable", Georgia, serif';
  const sans = '"Inter Variable", system-ui, sans-serif';
  ctx.fillStyle = '#f2f0eb';
  ctx.fillRect(0, 0, W, H);

  const hero = await loadImage('./images/hero.jpg');
  if (hero) {
    const h = 520;
    const scale = Math.max(W / hero.width, h / hero.height);
    const w2 = hero.width * scale;
    ctx.drawImage(hero, (W - w2) * 0.22, 0, w2, hero.height * scale);
    const g = ctx.createLinearGradient(0, h * 0.45, 0, h);
    g.addColorStop(0, 'rgba(242,240,235,0)');
    g.addColorStop(1, 'rgba(242,240,235,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, h);
  }

  const ink = '#1f2226';
  const muted = '#7a7d80';
  const slate = '#56718b';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = muted;
  ctx.font = `500 26px ${sans}`;
  ctx.fillText(`${o.length}-DAY CHALLENGE  ·  ${formatDate(o.start, 'dm').toUpperCase()} – ${formatDate(o.end, 'dm').toUpperCase()}`, 90, 600);

  ctx.fillStyle = ink;
  ctx.font = `400 104px ${serif}`;
  ctx.fillText(o.finished ? 'I did it.' : 'In progress.', 84, 720);
  ctx.font = `400 46px ${serif}`;
  ctx.fillStyle = '#55595e';
  ctx.fillText(`${s.completed} of ${s.total} challenges completed`, 90, 800);

  const stats: [string, string][] = [
    [String(s.pbs.length), 'personal bests'],
    [`${s.longestStreak} days`, 'longest streak'],
    [s.habitRate === null ? '—' : `${Math.round(s.habitRate * 100)}%`, 'habit adherence'],
  ];
  stats.forEach(([v, l], i) => {
    const x = 90 + i * 310;
    ctx.fillStyle = ink;
    ctx.font = `400 64px ${serif}`;
    ctx.fillText(v, x, 960);
    ctx.fillStyle = muted;
    ctx.font = `400 26px ${sans}`;
    ctx.fillText(l, x, 1004);
  });

  if (s.hardestCompleted) {
    ctx.fillStyle = slate;
    ctx.font = `500 24px ${sans}`;
    ctx.fillText('HARDEST CHALLENGE CONQUERED', 90, 1110);
    ctx.fillStyle = ink;
    ctx.font = `400 40px ${serif}`;
    let t = s.hardestCompleted.title;
    while (ctx.measureText(t).width > W - 180 && t.length > 10) t = `${t.slice(0, -2)}…`;
    ctx.fillText(t, 90, 1162);
  }

  ctx.strokeStyle = '#e2dfd8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(90, 1230);
  ctx.lineTo(W - 90, 1230);
  ctx.stroke();
  ctx.fillStyle = muted;
  ctx.font = `400 26px ${sans}`;
  ctx.fillText(o.name ? `${o.name} · One new skill a day` : 'One new skill a day', 90, 1284);

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'));
}
