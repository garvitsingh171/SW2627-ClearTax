import type { AuthenticatedUser } from "@/lib/auth";
import SignOutButton from "@/components/auth/SignOutButton";
import Icon from "@/components/ui/Icon";

interface HeaderProps {
  title?: string;
  user: AuthenticatedUser;
}

export default function Header({
  title = "Dashboard",
  user,
}: HeaderProps) {
  const userInitial = (user.name ?? user.email).trim().charAt(0).toUpperCase();

  return (
    <header
      className="
        sticky
        top-0
        z-30
        flex
        h-[var(--ds-header-height)]
        items-center
        justify-between
        border-b
        border-border
        bg-surface
        px-8
      "
    >
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>Workspace</span>
        <span className="text-slate-300">/</span>
        <h1 className="font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-foreground">
            {user.name ?? user.email}
          </p>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>

        <div
          className="
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-xl
            bg-info-surface
            text-sm
            font-semibold
            text-info-foreground
            "
          aria-label="User profile"
        >
          {userInitial}
        </div>

        <div className="hidden h-5 w-px bg-border sm:block" />
        <button type="button" className="hidden h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-surface-muted hover:text-foreground sm:inline-flex" aria-label="Open help">
          <Icon name="help" size={17} />
        </button>
        <SignOutButton />
      </div>
    </header>
  );
}
