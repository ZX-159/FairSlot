function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function downloadTicket(opts: {
  eventTitle: string;
  slotName: string;
  participantName: string;
  email: string;
  dateLabel: string;
  location: string;
  joinCode: string;
  ref: string;
  note?: string;
}) {
  const w = 1100;
  const h = 620;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#14241b';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#faf6ee';
  roundRect(ctx, 28, 28, w - 56, h - 56, 28);
  ctx.fill();

  ctx.fillStyle = '#1f4a36';
  roundRect(ctx, 28, 28, 210, h - 56, 28);
  ctx.fill();
  ctx.fillRect(28 + 170, 28, 40, h - 56);

  ctx.fillStyle = '#f3ead8';
  for (let y = 70; y < h - 50; y += 28) {
    ctx.beginPath();
    ctx.arc(238, y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(133, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#e8c27a';
  ctx.font = '600 18px "Source Sans 3", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FAIRSLOT  ·  ADMIT ONE', 0, -16);
  ctx.fillStyle = '#faf6ee';
  ctx.font = '680 42px Fraunces, Georgia, serif';
  ctx.fillText(opts.joinCode || 'TICKET', 0, 32);
  ctx.restore();

  const x = 280;
  ctx.fillStyle = '#6b8a72';
  ctx.font = '500 13px "Source Sans 3", sans-serif';
  ctx.fillText('CONFIRMED ALLOCATION', x, 88);

  ctx.fillStyle = '#14241b';
  ctx.font = '680 40px Fraunces, Georgia, serif';
  const titleLines = wrap(ctx, opts.eventTitle || 'Event', 740);
  titleLines.slice(0, 2).forEach((line, i) => ctx.fillText(line, x, 140 + i * 46));

  const afterTitle = 140 + Math.min(titleLines.length, 2) * 46 + 18;
  ctx.fillStyle = '#1f4a36';
  ctx.font = '560 26px Fraunces, Georgia, serif';
  ctx.fillText(opts.slotName || 'Slot', x, afterTitle);

  ctx.fillStyle = '#2c3d32';
  ctx.font = '500 18px "Source Sans 3", sans-serif';
  ctx.fillText(opts.participantName, x, afterTitle + 42);
  ctx.fillStyle = '#6b8a72';
  ctx.font = '400 15px "Source Sans 3", sans-serif';
  ctx.fillText(opts.email, x, afterTitle + 66);

  ctx.fillStyle = '#14241b';
  ctx.font = '500 16px "Source Sans 3", sans-serif';
  ctx.fillText(opts.dateLabel || 'Date TBC', x, afterTitle + 108);
  if (opts.location) ctx.fillText(opts.location, x, afterTitle + 132);

  if (opts.note) {
    ctx.fillStyle = '#6b8a72';
    ctx.font = 'italic 14px Fraunces, Georgia, serif';
    wrap(ctx, opts.note, 740)
      .slice(0, 2)
      .forEach((line, i) => ctx.fillText(line, x, afterTitle + 170 + i * 20));
  }

  ctx.fillStyle = '#d4a24a';
  ctx.fillRect(x, h - 110, 740, 1);
  ctx.fillStyle = '#6b8a72';
  ctx.font = '500 12px "Source Sans 3", sans-serif';
  ctx.fillText('REFERENCE', x, h - 78);
  ctx.fillStyle = '#14241b';
  ctx.font = '600 22px "Source Sans 3", monospace';
  ctx.fillText(opts.ref.toUpperCase(), x, h - 50);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fairslot-ticket-${opts.ref}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
