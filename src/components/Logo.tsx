export default function Logo({ className = '', light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect width="32" height="32" rx="9" fill={light ? '#E8C27A' : '#1A2E23'} />
        <path d="M8 21.5c2.4-5.2 5-8.8 8-10.8 3 2 5.6 5.6 8 10.8" stroke={light ? '#1A2E23' : '#E8C27A'} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="16" cy="9.2" r="1.6" fill="#C45C26" />
        <path d="M11.2 21.5h9.6" stroke={light ? '#3d6b4f' : '#7A9A6D'} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className={`font-display text-[1.15rem] tracking-tight ${light ? 'text-cream' : 'text-ink'}`}>FairSlot</span>
    </span>
  );
}
