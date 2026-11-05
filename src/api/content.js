const configuredBase = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const API_BASE = configuredBase.replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

async function request(path, { signal } = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('The content service is unreachable.', 0, null);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message || 'The content service returned an error.',
      response.status,
      payload,
    );
  }

  return payload;
}

const normalizeModule = (module) => {
  const videos = Array.isArray(module.videos) ? module.videos : [];
  const presenters = Array.isArray(module.presenters)
    ? module.presenters
    : Array.isArray(module.members)
      ? module.members
      : [];

  return {
    id: Number(module.id),
    slug: module.slug || '',
    title: module.title,
    description: module.description,
    summary: module.summary || '',
    pptUrl: module.pptUrl || module.ppt_url || null,
    videoUrl: videos.map((video) => video.url),
    videos,
    members: presenters.map((presenter) => ({
      name: presenter.name,
      role: presenter.role || 'Presenter',
    })),
    themeId: module.theme?.id || module.themeId || null,
    status: module.status || 'published',
  };
};

const normalizeTheme = (theme, modules) => ({
  id: theme.id,
  label: theme.label,
  range:
    theme.range ||
    `${String(theme.startModule || 1).padStart(2, '0')} — ${String(
      theme.endModule || modules.length,
    ).padStart(2, '0')}`,
  blurb: theme.blurb || '',
  modules: (theme.moduleIds || theme.modules || []).map(Number),
});

export async function fetchSiteContent({ signal } = {}) {
  const payload = await request('/content', { signal });
  const raw = payload?.data;

  if (!raw || !Array.isArray(raw.modules) || !Array.isArray(raw.themes)) {
    throw new ApiError('The content service returned an unexpected payload.', 0, payload);
  }

  const modules = raw.modules
    .map(normalizeModule)
    .sort((a, b) => a.id - b.id);
  const themes = raw.themes.map((theme) => normalizeTheme(theme, modules));

  return {
    modules,
    themes,
    stats: {
      modules: raw.stats?.modules ?? modules.length,
      presenters:
        raw.stats?.presenters ??
        new Set(modules.flatMap((module) => module.members.map((m) => m.name))).size,
      themes: raw.stats?.themes ?? themes.length,
      videos: raw.stats?.videos ?? modules.reduce((total, m) => total + m.videos.length, 0),
    },
    source: 'api',
  };
}
