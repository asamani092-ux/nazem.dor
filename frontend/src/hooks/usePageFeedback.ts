import { useState } from 'react';
import { useToast } from '../components/ds/Toast';

type BannerTone = 'success' | 'error' | 'info';

export function usePageFeedback() {
  const toast = useToast();
  const [banner, setBanner] = useState<{ tone: BannerTone; text: string } | null>(null);

  function notify(text: string, tone: BannerTone = 'success') {
    if (!text) return;
    if (text.includes('\n') || text.length > 72) {
      setBanner({ tone, text });
      return;
    }
    if (tone === 'error') toast.error(text);
    else if (tone === 'info') setBanner({ tone: 'info', text });
    else toast.success(text);
  }

  return {
    banner,
    notify,
    clearBanner: () => setBanner(null),
    toast,
  };
}
