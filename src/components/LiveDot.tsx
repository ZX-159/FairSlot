export default function LiveDot({ label = 'Live' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-moss/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-moss">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-moss opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-moss" />
      </span>
      {label}
    </span>
  );
}
