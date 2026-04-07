/** Apple Maps on iOS/iPadOS; Google Maps elsewhere. */
export function getMapsSearchUrl(address: string): string {
  const q = encodeURIComponent(address);
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) {
      return `https://maps.apple.com/?q=${q}`;
    }
  }
  return `https://www.google.com/maps?q=${q}`;
}
