import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { getSafeRedirectPath } from "@/lib/auth-redirect";
import { getCurrentUser } from "@/lib/auth";
import Icon from "@/components/ui/Icon";

export const runtime = "nodejs";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  const { next } = await searchParams;

  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(360px,0.9fr)_1.1fr]">
      <div className="hidden flex-col justify-between bg-primary p-12 text-white lg:flex">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg font-bold">C</span><div><p className="text-lg font-bold tracking-tight">ClearTax</p><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-white/65">Tax operations</p></div></div>
        <div className="max-w-sm"><p className="eyebrow text-white/60">A clearer close, every month</p><h2 className="mt-4 text-4xl font-bold leading-tight tracking-[-.04em]">Reconcile with confidence.</h2><p className="mt-5 text-sm leading-6 text-white/70">Bring your GSTR-2B and purchase register together in one secure, reviewable workspace.</p><div className="mt-8 space-y-3 text-sm text-white/80"><p className="flex items-center gap-2"><Icon name="check" size={16} /> Faster invoice review</p><p className="flex items-center gap-2"><Icon name="check" size={16} /> Clear exception handling</p><p className="flex items-center gap-2"><Icon name="shield" size={16} /> Business-level data isolation</p></div></div>
        <p className="text-xs text-white/45">ClearTax GST reconciliation workspace</p>
      </div>
      <div className="flex min-h-screen w-full flex-col justify-center px-6 py-12 sm:px-10 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden"><div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">C</span><p className="text-base font-bold tracking-tight text-foreground">ClearTax</p></div></div>
          <div><p className="eyebrow">Secure workspace</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Access reconciliation</h1><p className="mt-2 text-sm text-slate-500">Sign in or create your first business workspace.</p></div>
          <LoginForm nextPath={getSafeRedirectPath(next ?? null)} />
        </div>
      </div>
    </main>
  );
}
