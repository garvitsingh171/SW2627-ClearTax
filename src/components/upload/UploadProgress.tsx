"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Icon from "@/components/ui/Icon";

type UploadStatus = "idle" | "selected" | "uploading" | "completed" | "error";
type UploadMode = "gstr2b" | "purchase_register";
type ReferenceImportOption = { id: string; originalFilename: string; financialYear: string; returnPeriod: string; status: string };
type UploadProgressProps = { referenceImports: ReferenceImportOption[] };
type ApiSuccessPayload = { success?: true; data?: { id?: string } };
type ApiErrorPayload = { error?: { code?: string; message?: string } };

const modeConfig: Record<UploadMode, { endpoint: string; accept: string; title: string; extension: string; description: string }> = {
  gstr2b: { endpoint: "/api/reference-imports", accept: ".json,application/json,text/json", title: "GSTR-2B JSON", extension: "JSON", description: "Upload the reference data downloaded from the GST portal." },
  purchase_register: { endpoint: "/api/reconciliation-batches", accept: ".csv,text/csv,application/csv", title: "Purchase Register CSV", extension: "CSV", description: "Compare your purchase register against an imported GSTR-2B." },
};

export default function UploadProgress({ referenceImports }: UploadProgressProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<UploadMode>("gstr2b");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [resultLink, setResultLink] = useState<string | null>(null);
  const [financialYear, setFinancialYear] = useState("");
  const [returnPeriod, setReturnPeriod] = useState("");
  const [referenceImportId, setReferenceImportId] = useState(referenceImports[0]?.id ?? "");
  const [isDragOver, setIsDragOver] = useState(false);
  const currentMode = modeConfig[mode];
  const selectedReferenceImportId = referenceImportId || referenceImports[0]?.id || "";

  function selectFile(selectedFile: File | undefined) {
    if (!selectedFile) return;
    setFile(selectedFile); setProgress(0); setStatus("selected"); setMessage(""); setRequestId(null); setResultLink(null);
  }
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) { selectFile(event.target.files?.[0]); }
  async function handleUpload() {
    if (!file) return;
    if (mode === "purchase_register" && !selectedReferenceImportId) { setStatus("error"); setMessage("Select a reference import before uploading a purchase register."); return; }
    setStatus("uploading"); setProgress(0); setMessage(""); setRequestId(null); setResultLink(null);
    const formData = new FormData(); formData.append("file", file);
    if (mode === "purchase_register") formData.append("referenceImportId", selectedReferenceImportId);
    else { if (financialYear.trim()) formData.append("financialYear", financialYear.trim()); if (returnPeriod.trim()) formData.append("returnPeriod", returnPeriod.trim()); }
    try {
      const response = await fetch(currentMode.endpoint, { method: "POST", body: formData });
      const responseRequestId = response.headers.get("x-request-id");
      const payload = (await response.json().catch(() => null)) as (ApiSuccessPayload & ApiErrorPayload) | null;
      setRequestId(responseRequestId);
      if (!response.ok) { setStatus("error"); setMessage(getApiErrorMessage(payload)); return; }
      const createdId = payload?.data?.id; setProgress(100); setStatus("completed"); setMessage(`${currentMode.title} uploaded successfully.`);
      setResultLink(createdId ? mode === "gstr2b" ? `/reference-imports/${createdId}` : `/reconciliations/${createdId}` : null); router.refresh();
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Upload failed unexpectedly."); }
  }
  function reset() { setFile(null); setProgress(0); setStatus("idle"); setMessage(""); setRequestId(null); setResultLink(null); if (inputRef.current) inputRef.current.value = ""; }
  function handleModeChange(nextMode: UploadMode) { setMode(nextMode); reset(); }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <div className="border-b border-border bg-gradient-to-r from-surface to-info-surface/35 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm"><Icon name="upload" size={19} /></span><div><p className="eyebrow">Get started</p><h2 className="mt-1 text-base font-bold text-foreground">Upload reconciliation files</h2><p className="mt-1 text-sm text-slate-500">Start with reference data, then compare your purchase register.</p></div></div>
          <div className="flex rounded-lg border border-border bg-surface-muted p-1" role="tablist" aria-label="Upload file type">{(["gstr2b", "purchase_register"] as UploadMode[]).map((item) => <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => handleModeChange(item)} className={`rounded-md px-3 py-2 text-xs font-semibold transition-all ${mode === item ? "bg-surface text-foreground shadow-sm" : "text-slate-500 hover:text-foreground"}`}>{item === "gstr2b" ? "GSTR-2B" : "Purchase Register"}</button>)}</div>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-info/15 bg-info-surface/50 p-3.5"><Icon name="file" size={17} className="mt-0.5 shrink-0 text-info" /><div><p className="text-sm font-semibold text-info-foreground">{currentMode.title}</p><p className="mt-0.5 text-xs leading-5 text-info-foreground/75">{currentMode.description} Accepted format: {currentMode.extension}, up to 10 MB.</p></div></div>
        {mode === "gstr2b" ? <div className="mb-5 grid gap-4 sm:grid-cols-2"><Field label="Financial year" value={financialYear} onChange={setFinancialYear} placeholder="2026-27" /><Field label="Return period" value={returnPeriod} onChange={setReturnPeriod} placeholder="042026" /></div> : <label className="mb-5 block text-sm font-semibold text-foreground">Reference import<select value={selectedReferenceImportId} onChange={(event) => setReferenceImportId(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">{referenceImports.length > 0 ? referenceImports.map((referenceImport) => <option key={referenceImport.id} value={referenceImport.id}>{referenceImport.originalFilename} · {referenceImport.returnPeriod} {referenceImport.financialYear} ({referenceImport.status})</option>) : <option value="">No reference imports available</option>}</select></label>}
        <input ref={inputRef} type="file" accept={currentMode.accept} onChange={handleFileChange} className="sr-only" />
        <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={(event) => { event.preventDefault(); setIsDragOver(false); selectFile(event.dataTransfer.files?.[0]); }} className={`flex min-h-[148px] w-full flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center transition-colors ${isDragOver ? "border-primary bg-info-surface" : "border-border-strong bg-surface-muted/55 hover:border-primary/60 hover:bg-info-surface/40"}`}><span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-primary shadow-sm"><Icon name="upload" size={19} /></span><span className="mt-3 text-sm font-semibold text-foreground">Drop your {currentMode.extension} file here or <span className="text-primary">browse</span></span><span className="mt-1 text-xs text-slate-500">Only {currentMode.extension} files are accepted</span></button>
        {file ? <div className="mt-4 rounded-lg border border-border bg-surface-muted/65 p-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-primary"><Icon name="file" size={17} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{file.name}</p><p className="mt-0.5 text-xs text-slate-500">{formatFileSize(file.size)} · {statusLabel(status)}</p></div>{status === "completed" ? <Icon name="check" size={18} className="text-success" /> : null}</div>{status === "uploading" || status === "completed" || progress > 0 ? <div className="mt-4"><div className="mb-1.5 flex justify-between text-[11px] font-medium text-slate-500"><span>{status === "uploading" ? "Uploading and validating" : "Upload complete"}</span><span>{progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} /></div></div> : null}<div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={handleUpload} disabled={status === "uploading" || (mode === "purchase_register" && referenceImports.length === 0)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-hover active:translate-y-px disabled:pointer-events-none disabled:opacity-50">{status === "uploading" ? <><span className="spinner" /> Uploading…</> : "Start upload"}</button><button type="button" onClick={reset} className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted">Remove</button></div></div> : null}
        {message ? <div className={`mt-4 rounded-lg border p-4 text-sm ${status === "error" ? "border-error/25 bg-error-surface text-error-foreground" : "border-success/25 bg-success-surface text-success-foreground"}`}><div className="flex gap-2"><Icon name={status === "error" ? "warning" : "check"} size={16} className="mt-0.5 shrink-0" /><div><p className="font-semibold">{message}</p>{requestId ? <p className="mt-1 font-mono text-xs opacity-75">Request ID: {requestId}</p> : null}{resultLink ? <Link href={resultLink} className="mt-2 inline-flex text-sm font-semibold underline underline-offset-4">Open record →</Link> : null}</div></div></div> : null}
      </div>
    </section>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="text-sm font-semibold text-foreground">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-normal outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>; }
function formatFileSize(bytes: number) { return `${(bytes / 1024 / 1024).toFixed(2)} MB`; }
function statusLabel(status: UploadStatus) { return { idle: "Ready to upload", selected: "Ready to upload", uploading: "Uploading", completed: "Uploaded", error: "Upload failed" }[status]; }
function getApiErrorMessage(payload: (ApiErrorPayload & ApiSuccessPayload) | null) { return payload?.error?.message ?? payload?.error?.code ?? "Upload failed. Check the file and try again."; }
