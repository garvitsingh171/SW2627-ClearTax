import WorkspaceNavLinks from "@/components/layout/WorkspaceNavLinks";
import Icon from "@/components/ui/Icon";

export default function Sidebar() {
  return (
    <aside
      className="
        fixed
        inset-y-0
        left-0
        z-40
        hidden
        w-[var(--ds-sidebar-width)]
        border-r
        border-border
        bg-surface
        lg:flex
        lg:flex-col
      "
    >
      {/* Logo */}
      <div
        className="
          flex
          h-[var(--ds-header-height)]
          items-center
          border-b
          border-border
        px-5
        "
      >
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white shadow-sm">C</span>
            <div>
              <p className="text-[15px] font-bold tracking-tight text-foreground">ClearTax</p>

              <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-slate-500">Tax operations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">
          Workspace
        </p>

        <WorkspaceNavLinks
          iconClassName="text-base"
          linkClassName="transition-colors"
        />
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <div className="rounded-lg border border-info/15 bg-info-surface/60 p-3">
          <div className="flex items-start gap-2">
            <Icon name="shield" size={15} className="mt-0.5 text-info" />
            <div>
              <p className="text-xs font-semibold text-info-foreground">Secure workspace</p>
              <p className="mt-1 text-[11px] leading-4 text-info-foreground/75">Your GST data stays private to this business.</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
