// Kept apart from CodeEditor so the file tree doesn't pull Monaco into the main bundle.
export const languageFor = (path: string): string => {
  const name = path.split('/').pop() ?? '';
  if (name.endsWith('.rs')) return 'rust';
  if (name.endsWith('.json')) return 'json';
  if (name.endsWith('.md')) return 'markdown';
  if (name === 'Dockerfile') return 'dockerfile';
  if (name.endsWith('.toml') || name.startsWith('.env')) return 'ini';
  return 'plaintext';
};

type FileType = { badge: string; color: string; label: string };

export const fileTypeOf = (path: string): FileType => {
  const name = path.split('/').pop() ?? '';
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() : undefined;
  if (ext === 'rs') return { badge: 'rs', color: '#e06c3c', label: 'Rust' };
  if (ext === 'toml') return { badge: 'tm', color: '#9ca3af', label: 'TOML' };
  if (ext === 'md') return { badge: 'md', color: '#519aba', label: 'Markdown' };
  if (ext === 'json') return { badge: '{}', color: '#e5c07b', label: 'JSON' };
  if (ext === 'lock') return { badge: 'lk', color: '#8b8b8b', label: 'Lockfile' };
  if (ext === 'yml' || ext === 'yaml') return { badge: 'ym', color: '#c678dd', label: 'YAML' };
  if (ext === 'sh') return { badge: 'sh', color: '#98c379', label: 'Shell' };
  if (name === 'Dockerfile') return { badge: 'dk', color: '#2496ed', label: 'Dockerfile' };
  if (name.startsWith('.env')) return { badge: 'en', color: '#e5c07b', label: 'Env' };
  if (name.startsWith('.git')) return { badge: 'gt', color: '#f05033', label: 'Git' };
  return { badge: '··', color: '#8b8b8b', label: 'Plain Text' };
};
