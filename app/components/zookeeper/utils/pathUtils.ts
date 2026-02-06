// Path manipulation and breadcrumb utilities

/**
 * Normalize path to ensure it starts with / and has no trailing slash
 * Returns '/' for empty or invalid paths
 */
export const normalizePath = (value: string): string => {
  if (!value) return '/';
  const trimmed = value.trim();
  if (!trimmed) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

/**
 * Generate breadcrumb array from a path
 * Example: '/foo/bar' => ['/', '/foo', '/foo/bar']
 */
export const generateBreadcrumbs = (selectedPath: string): string[] => {
  if (selectedPath === '/') return ['/'];
  const parts = selectedPath.split('/').filter(Boolean);
  const crumbs = ['/'];
  let current = '';
  parts.forEach(part => {
    current += `/${part}`;
    crumbs.push(current);
  });
  return crumbs;
};

/**
 * Get parent path of a given path
 * Example: '/foo/bar' => '/foo', '/foo' => '/'
 */
export const getParentPath = (path: string): string => {
  if (path === '/') return '/';
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 1) return '/';
  parts.pop();
  return '/' + parts.join('/');
};

/**
 * Get node name from a path
 * Example: '/foo/bar' => 'bar', '/' => '/'
 */
export const getNodeName = (path: string): string => {
  if (path === '/') return '/';
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || '/';
};
