"use client";

import { useMemo, useState } from "react";
import { formatDateTimeJapan } from "@/lib/datetime-japan";

type Row = {
  facilityId: string;
  facilityName: string;
  hasImage: boolean;
  uploadedAtIso: string | null;
  uploadedById: string | null;
  imageUrl: string | null;
};

export function SchedulesAdminClient({
  initialMonth,
  initialRows,
}: {
  initialMonth: string;
  initialRows: Row[];
}) {
  const [month, setMonth] = useState(initialMonth);
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fileByFacility, setFileByFacility] = useState<Record<string, File | null>>({});
  const [zoom, setZoom] = useState<{ name: string; url: string } | null>(null);

  const rowsById = useMemo(() => new Map(rows.map((r) => [r.facilityId, r])), [rows]);

  async function reload(targetMonth: string) {
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/admin/schedules?month=${encodeURIComponent(targetMonth)}`, {
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; rows?: Row[] };
    setBusy(false);
    if (!res.ok || !Array.isArray(json.rows)) {
      setMessage("一覧の取得に失敗しました。");
      return;
    }
    setRows(json.rows);
  }

  async function onUpload(facilityId: string) {
    const file = fileByFacility[facilityId];
    if (!file) {
      setMessage("アップロードするPNGを選択してください。");
      return;
    }
    setBusy(true);
    setMessage("");
    const fd = new FormData();
    fd.append("facilityId", facilityId);
    fd.append("month", month);
    fd.append("file", file);
    const res = await fetch("/api/admin/schedules/upload", {
      method: "POST",
      body: fd,
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      if (json.error === "file_must_be_png") {
        setMessage("PNG形式のファイルを選択してください。");
      } else if (json.error === "file_too_large") {
        setMessage("ファイルサイズが大きすぎます（8MBまで）。");
      } else {
        setMessage("アップロードに失敗しました。");
      }
      return;
    }
    setFileByFacility((prev) => ({ ...prev, [facilityId]: null }));
    await reload(month);
    setMessage("保存しました。");
  }

  async function onDelete(facilityId: string) {
    if (!confirm("この月の画像を削除します。よろしいですか？")) return;
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/admin/schedules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId, month }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage("削除に失敗しました。");
      return;
    }
    await reload(month);
    setMessage("削除しました。");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h1 className="text-lg font-bold text-slate-900">予定表画像の管理</h1>
        <p className="mt-1 text-xs text-slate-600">事業所ごとに月別PNGを登録します。再アップロードで差し替えできます。</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => reload(month)}
            disabled={busy}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 disabled:opacity-60"
          >
            {busy ? "読込中..." : "表示更新"}
          </button>
        </div>
        {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-3">
        {rows.map((r) => {
          const current = rowsById.get(r.facilityId) ?? r;
          const previewFile = fileByFacility[r.facilityId];
          return (
            <section
              key={r.facilityId}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100"
            >
              <h2 className="text-base font-semibold text-slate-900">{r.facilityName}</h2>
              {current.hasImage && current.uploadedAtIso ? (
                <p className="mt-1 text-xs text-slate-600">更新: {formatDateTimeJapan(current.uploadedAtIso)}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">この月の画像は未登録です。</p>
              )}
              {current.imageUrl ? (
                <button
                  type="button"
                  onClick={() => setZoom({ name: r.facilityName, url: current.imageUrl! })}
                  className="mt-3 block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 text-left"
                >
                  <img src={current.imageUrl} alt={`${r.facilityName} ${month}`} className="h-auto w-full" />
                  <p className="mt-2 text-xs text-blue-700">クリックして拡大</p>
                </button>
              ) : null}

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="file"
                  accept="image/png,.png"
                  onChange={(e) =>
                    setFileByFacility((prev) => ({
                      ...prev,
                      [r.facilityId]: e.target.files?.[0] ?? null,
                    }))
                  }
                  className="w-full text-sm"
                />
                <button
                  type="button"
                  disabled={busy || !previewFile}
                  onClick={() => onUpload(r.facilityId)}
                  className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  登録
                </button>
                <button
                  type="button"
                  disabled={busy || !current.hasImage}
                  onClick={() => onDelete(r.facilityId)}
                  className="min-h-11 rounded-xl border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-700 disabled:opacity-50"
                >
                  削除
                </button>
              </div>
            </section>
          );
        })}
      </div>
      {zoom ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setZoom(null)}
        >
          <div
            className="max-h-[95vh] w-full max-w-5xl overflow-auto rounded-xl bg-white p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">{zoom.name}</p>
              <button
                type="button"
                onClick={() => setZoom(null)}
                className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                閉じる
              </button>
            </div>
            <img src={zoom.url} alt={`${zoom.name} 拡大`} className="h-auto w-full" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

