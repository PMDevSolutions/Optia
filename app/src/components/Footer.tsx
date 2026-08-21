import { Globe, Bug, Shield } from "lucide-react";

// All links point at Optia properties: the GitHub Pages site (also the Chrome
// Web Store listing's website/privacy URLs) and the repo's issue tracker,
// which is the published support/data-request contact path (see
// docs/privacy-policy.md). Keep these in sync with docs/chrome-web-store-listing.md.
const links = [
  { label: "Website", icon: Globe, href: "https://pmdevsolutions.github.io/Optia/" },
  { label: "Privacy", icon: Shield, href: "https://pmdevsolutions.github.io/Optia/privacy.html" },
  { label: "Support", icon: Bug, href: "https://github.com/PMDevSolutions/Optia/issues" },
];

export function Footer() {
  return (
    <footer className="rounded-card-lg border border-border bg-surface px-4 py-3 shadow-card">
      <div className="flex items-center justify-between gap-1.5">
        {links.map(({ label, icon: Icon, href }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-muted transition-colors hover:text-brand"
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            {label}
          </a>
        ))}
      </div>
    </footer>
  );
}
