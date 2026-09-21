"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/ui/Icon";

const navigation = [
  {
    name: "Dashboard",
    href: "/",
    icon: "grid" as IconName,
  },
  {
    name: "Reconciliations",
    href: "/reconciliations",
    icon: "activity" as IconName,
  },
  {
    name: "Reference Imports",
    href: "/reference-imports",
    icon: "upload" as IconName,
  },
];

interface WorkspaceNavLinksProps {
  iconClassName?: string;
  linkClassName?: string;
  onNavigate?: () => void;
}

export default function WorkspaceNavLinks({
  iconClassName = "",
  linkClassName = "",
  onNavigate,
}: WorkspaceNavLinksProps) {
  const pathname = usePathname();

  return (
    <div className="space-y-1">
      {navigation.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`
              flex
              items-center
              gap-3
              rounded-lg
              px-3
              py-2.5
              text-sm
              font-medium
              ${linkClassName}
              ${
                isActive
                  ? "bg-info-surface text-info-foreground shadow-sm"
                  : "text-slate-600 hover:bg-surface-muted hover:text-foreground"
              }
            `}
          >
            <span className={iconClassName} aria-hidden="true">
              <Icon name={item.icon} size={17} />
            </span>

            <span>{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
