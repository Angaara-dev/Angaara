import { Icons, IconSrc } from 'folds';
import { DeveloperSection } from '../../paths';

// Kept apart from DeveloperTools.tsx so the sidebar doesn't pull in the lazy-loaded pages.
type DeveloperPage = { title: string; icon: IconSrc; danger?: boolean };
export const DEVELOPER_PAGES: Record<DeveloperSection, DeveloperPage> = {
  bot: { title: 'Your Bot', icon: Icons.User },
  build: { title: 'Build Tools', icon: Icons.Terminal },
  // Only listed in the sidebar once a GitHub repo is connected.
  repos: { title: 'Linked Developer Repos', icon: Icons.Link },
  docs: { title: 'Docs', icon: Icons.File },
  // These two are only listed for accounts with the developer badge.
  reports: { title: 'App Reports', icon: Icons.Warning },
  bugs: { title: 'User Bug Reports', icon: Icons.Flag, danger: true },
};
