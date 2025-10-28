// Runtime theming for background image based on env var
// Set in .env.local as: VITE_BG_IMAGE=/path/or/url.jpg

const bgImage = (import.meta as any).env?.VITE_BG_IMAGE as string | undefined;
if (bgImage) {
  try {
    const value = `url('${bgImage}')`;
    document.documentElement.style.setProperty('--app-bg-image', value);
  } catch {
    // no-op: fallback CSS will be used
  }
}

