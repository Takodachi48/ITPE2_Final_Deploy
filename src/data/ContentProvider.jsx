import { useEffect, useMemo, useState } from 'react';
import { fetchSiteContent } from '../api/content';
import {
  formatName,
  modules as bundledModules,
  presenterCount as bundledPresenterCount,
  themes as bundledThemes,
} from './modules';
import { ContentContext } from './ContentContext';

const bundledStats = {
  modules: bundledModules.length,
  presenters: bundledPresenterCount,
  themes: bundledThemes.length,
  videos: bundledModules.reduce((total, module) => {
    if (Array.isArray(module.videoUrl)) return total + module.videoUrl.length;
    return total + (module.videoUrl ? 1 : 0);
  }, 0),
};

const fallbackContent = {
  modules: bundledModules,
  themes: bundledThemes,
  stats: bundledStats,
  source: 'bundled',
};

const buildRoster = (modules) => {
  const people = new Map();

  modules.forEach((module) => {
    module.members.forEach(({ name }) => {
      if (!people.has(name)) {
        people.set(name, { name: formatName(name), modules: [] });
      }
      people.get(name).modules.push(module.id);
    });
  });

  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
};

export default function ContentProvider({ children }) {
  const [content, setContent] = useState(fallbackContent);
  const [syncStatus, setSyncStatus] = useState('loading');

  useEffect(() => {
    const controller = new AbortController();

    fetchSiteContent({ signal: controller.signal })
      .then((next) => {
        if (!next.modules.length || !next.themes.length) {
          setSyncStatus('fallback');
          return;
        }

        setContent(next);
        setSyncStatus('ready');
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setSyncStatus('fallback');
      });

    return () => controller.abort();
  }, []);

  const value = useMemo(() => {
    const themes = content.themes.map((theme) => ({
      ...theme,
      modules: theme.modules?.length
        ? theme.modules
        : content.modules
            .filter((module) => module.themeId === theme.id)
            .map((module) => module.id),
    }));

    const themeForModule = (id) => {
      const moduleId = Number(id);
      const byId = themes.find((theme) => theme.modules.includes(moduleId));

      if (byId) return byId;

      const module = content.modules.find((item) => item.id === moduleId);
      return themes.find((theme) => theme.id === module?.themeId);
    };

    const presenterCount =
      content.stats?.presenters ??
      content.modules.reduce(
        (total, module) => total + module.members.length,
        0,
      );

    return {
      modules: content.modules,
      themes,
      stats: content.stats,
      presenterCount,
      themeForModule,
      roster: buildRoster(content.modules),
      source: content.source,
      syncStatus,
    };
  }, [content, syncStatus]);

  return (
    <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
  );
}
