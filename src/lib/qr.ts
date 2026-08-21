import QRCode from 'qrcode';

/** Render a magic-link QR as a PNG data URL (offline, no network). */
export async function qrToDataUrl(text: string, size = 240): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: size,
    color: {
      dark: '#14241b',
      light: '#faf6ee',
    },
  });
}
