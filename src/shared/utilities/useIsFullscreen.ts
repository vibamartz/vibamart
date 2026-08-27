import { useState, useEffect } from 'react';

/**
 * Utility function to check if the application or browser is currently in any full screen mode.
 */
export function checkIsFullscreen(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Native HTML5 Fullscreen API check
  const docFullscreen = Boolean(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement ||
    (document as any).webkitIsFullScreen
  );
  if (docFullscreen) return true;

  // 2. Window display-mode fullscreen match
  if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) {
    return true;
  }

  // 3. Document or Body class / attribute check
  const isHtmlFullscreen =
    document.documentElement.classList.contains('fullscreen') ||
    document.documentElement.classList.contains('fullscreen-mode') ||
    document.documentElement.getAttribute('data-fullscreen') === 'true';

  const isBodyFullscreen =
    document.body.classList.contains('fullscreen') ||
    document.body.classList.contains('fullscreen-mode') ||
    document.body.getAttribute('data-fullscreen') === 'true';

  if (isHtmlFullscreen || isBodyFullscreen) return true;

  // 4. Any element in DOM with data-fullscreen="true"
  if (document.querySelector('[data-fullscreen="true"]')) return true;

  // 5. Custom window property
  if ((window as any).__IS_FULLSCREEN__) return true;

  return false;
}

/**
 * Programmatically update global fullscreen state / attribute and notify listeners.
 */
export function setGlobalFullscreen(isFullscreen: boolean): void {
  if (typeof window === 'undefined') return;
  (window as any).__IS_FULLSCREEN__ = isFullscreen;
  if (isFullscreen) {
    document.documentElement.setAttribute('data-fullscreen', 'true');
  } else {
    document.documentElement.removeAttribute('data-fullscreen');
  }
  window.dispatchEvent(new CustomEvent('viba-fullscreen-change', { detail: { isFullscreen } }));
}

/**
 * Custom React hook to detect if full screen mode is active.
 * Automatically auto-hides bottom navigation bar in any full screen mode.
 */
export function useIsFullscreen(): boolean {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => checkIsFullscreen());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFullscreenChange = () => {
      setIsFullscreen(checkIsFullscreen());
    };

    // Native HTML5 & vendor-prefixed event listeners
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Window resize & custom event listeners
    window.addEventListener('resize', handleFullscreenChange);
    window.addEventListener('viba-fullscreen-change', handleFullscreenChange as EventListener);

    // Media query listener
    const mediaQuery = window.matchMedia('(display-mode: fullscreen)');
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleFullscreenChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleFullscreenChange);
    }

    // MutationObserver to watch DOM attribute & class changes
    const observer = new MutationObserver(() => {
      handleFullscreenChange();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-fullscreen'],
      subtree: false,
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-fullscreen'],
      subtree: false,
    });

    // Initial check on mount
    handleFullscreenChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);

      window.removeEventListener('resize', handleFullscreenChange);
      window.removeEventListener('viba-fullscreen-change', handleFullscreenChange as EventListener);

      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleFullscreenChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleFullscreenChange);
      }

      observer.disconnect();
    };
  }, []);

  return isFullscreen;
}
