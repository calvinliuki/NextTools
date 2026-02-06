'use client';

interface BreadcrumbNavProps {
  breadcrumbs: string[];
  onNavigate: (path: string) => void;
  onCopyPath: () => void;
  currentPath: string;
  labels: {
    root: string;
    copyPath: string;
  };
}

/**
 * Breadcrumb navigation component
 * Shows the current path hierarchy with clickable navigation
 */
export function BreadcrumbNav({
  breadcrumbs,
  onNavigate,
  onCopyPath,
  currentPath,
  labels,
}: BreadcrumbNavProps) {
  return (
    <div className="flex items-center gap-2 overflow-hidden mr-4">
      <i className="fas fa-folder-open text-gray-400 text-sm"></i>
      <div className="flex items-center gap-1 text-xs font-medium text-gray-600 overflow-hidden">
        {breadcrumbs.map((crumb, idx) => (
          <span key={crumb} className="flex items-center gap-1 shrink-0">
            {idx > 0 && <span className="text-gray-300">/</span>}
            <button
              className="hover:text-[#007acc] truncate max-w-[120px]"
              onClick={() => onNavigate(crumb)}
              title={crumb}
            >
              {idx === 0 ? labels.root : crumb.split('/').pop() || '/'}
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
