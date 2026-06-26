import { BookOpen, Lightbulb, Bug, Mail } from "lucide-react";

const links = [
  { label: "Documentation", icon: BookOpen, href: "https://ai-seo-copilot.gitbook.io/ai-seo-copilot/" },
  { label: "Feature requests", icon: Lightbulb, href: "https://aiseocopilot.featurebase.app/" },
  { label: "Report a bug", icon: Bug, href: "https://github.com/PMDevSolutions/seo-copilot/issues" },
  { label: "Contact us", icon: Mail, href: "mailto:sofianbettayeb@gmail.com" },
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
