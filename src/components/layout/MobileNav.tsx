"use client";

import { useState } from "react";
import WorkspaceNavLinks from "@/components/layout/WorkspaceNavLinks";
import Icon from "@/components/ui/Icon";

type MobileNavProps = {
  userInitial: string;
};

export default function MobileNav({ userInitial }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile Header */}
      <div
        className="
          flex
          h-[var(--ds-header-height)]
          items-center
          justify-between
          border-b
          border-border
          bg-surface
          px-4
          lg:hidden
        "
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-md
            text-lg
            text-foreground
            hover:bg-surface-muted
          "
          aria-label="Open navigation"
        >
          <Icon name="menu" size={19} />
        </button>

        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">C</span>
          <p className="text-sm font-bold tracking-tight text-foreground">ClearTax</p>
        </div>

        <div
          className="
            flex
            h-8
            w-8
            items-center
            justify-center
            rounded-xl
            bg-info-surface
            text-xs
            font-semibold
            text-info-foreground
          "
        >
          {userInitial}
        </div>
      </div>

      {/* Overlay */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="
            fixed
            inset-0
            z-40
            bg-black/30
            lg:hidden
          "
        />
      )}

      {/* Drawer */}
      <aside
        className={`
          fixed
          inset-y-0
          left-0
          z-50
          w-[280px]
          border-r
          border-border
          bg-surface
          shadow-dropdown
          transition-transform
          duration-200
          lg:hidden
          ${
            open
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >
        <div
          className="
            flex
            h-[var(--ds-header-height)]
            items-center
            justify-between
            border-b
            border-border
            px-5
          "
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">C</span>
            <div>
              <p className="text-[15px] font-bold tracking-tight text-foreground">ClearTax</p>
              <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-slate-500">Tax operations</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-md
              text-lg
              text-slate-500
              hover:bg-surface-muted
              hover:text-foreground
            "
            aria-label="Close navigation"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <nav className="p-4">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Workspace
          </p>

          <WorkspaceNavLinks onNavigate={() => setOpen(false)} />
        </nav>
      </aside>
    </>
  );
}
