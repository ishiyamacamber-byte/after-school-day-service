"use client";

import { useState } from "react";

export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");
  const [useRowOrder, setUseRowOrder] = useState(false);
  const [rowOrderStart, setRowOrderStart] = useState(1);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setResult("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("useRowOrder", useRowOrder ? "1" : "0");
    fd.append("rowOrderStart", String(rowOrderStart));

    const res = await fetch("/api/admin/import-users", {
      method: "POST",
      body: fd,
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setResult(`取込に失敗しました: ${json.error ?? "unknown_error"}`);
      return;
    }
    const errors = Array.isArray(json.errors) && json.errors.length > 0 ? `\n${json.errors.join("\n")}` : "";
    setResult(
      `完了: 作成 ${json.created} / 更新 ${json.updated} / スキップ ${json.skipped}${errors}`
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-slate-900">利用者CSV取込</h1>
      <p className="text-sm text-slate-600">
        ExcelやスプレッドシートをCSVで保存して取り込みます。
      </p>

      <div className="rounded-2xl bg-white p-4 text-xs leading-6 text-slate-700 shadow-sm ring-1 ring-slate-200">
        必須列:
        <br />
        <code>login_id,name,monthly_limit,allowed_facilities</code>
        <br />
        任意列:
        <br />
        <code>
          management_no,password,default_sun,default_mon,default_tue,default_wed,default_thu,default_fri,default_sat
        </code>
        <br />
        allowed_facilities は事業所IDまたは事業所名を <code>|</code> 区切りで指定
        <br />
        <span className="text-slate-600">
          <strong>management_no</strong>: 利用者ごとの管理番号（1以上の整数）。未入力のときは下の「CSV行順で番号を付与」か、新規のみ自動採番（既存の最大+1）になります。
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 shadow-sm ring-1 ring-slate-100">
        <p className="font-semibold text-slate-900">管理番号（取込時）</p>
        <label className="mt-2 flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={useRowOrder}
            onChange={(e) => setUseRowOrder(e.target.checked)}
            className="mt-1"
          />
          <span>
            <strong>CSVの行順で管理番号を付与する</strong>（1行目のデータ＝開始番号、2行目＝開始+1…）。列{" "}
            <code>management_no</code> に値がある行はそちらを優先します。
          </span>
        </label>
        <label className="mt-3 flex flex-wrap items-center gap-2 text-slate-700">
          開始番号
          <input
            type="number"
            min={1}
            value={rowOrderStart}
            onChange={(e) => setRowOrderStart(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="min-h-10 w-24 rounded-lg border border-slate-300 px-2 text-base"
          />
        </label>
      </div>

      <form onSubmit={onSubmit} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm"
        />
        <button
          type="submit"
          disabled={!file || busy}
          className="mt-4 min-h-12 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "取込中..." : "CSVを取り込む"}
        </button>
      </form>

      {result && (
        <pre className="whitespace-pre-wrap rounded-xl bg-slate-100 p-3 text-xs text-slate-800">{result}</pre>
      )}
    </div>
  );
}
