"use client";

import { useState } from "react";
import { formatDateTimeJapan } from "@/lib/datetime-japan";
import type { MediaKind, MediaSlot } from "@/lib/facility-media-file";

type MediaFile = {
  slot: MediaSlot;
  mediaKind: MediaKind;
  imageUrl: string;
  uploadedAtIso: string;
};

type Row = {
  facilityId: string;
  facilityName: string;
  files: MediaFile[];
};

const ACCEPT = "image/png,image/jpeg,.png,.jpg,.jpeg,application/pdf,.pdf";

function fileKey(facilityId: string, slot: MediaSlot) {
  return `${facilityId}:${slot}`;
}

function MediaPreview({
  url,
  kind,
  alt,
  className,
}: {
  url: string;
  kind: MediaKind;
  alt: string;
  className?: string;
}) {
  if (kind === "pdf") {
    return (
      <iframe
        src={url}
        title={alt}
        className={className ?? "h-64 w-full rounded-xl border border-slate-200 bg-white"}
      />
    );
  }
  return <img src={url} alt={alt} className={className ?? "h-auto w-full"} />;
}

export function NewslettersAdminClient({
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
  const [fileByKey, setFileByKey] = useState<Record<string, File | null>>({});
  const [zoom, setZoom] = useState<{ name: string; url: string; kind: MediaKind } | null>(null);

  async function reload(targetMonth: string) {
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/admin/newsletters?month=${encodeURIComponent(targetMonth)}`, {
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; rows?: Row[] };
    setBusy(false);
    if (!res.ok || !Array.isArray(json.rows)) {
      setMessage("一覧の取得に失敗しました。");
      return;
    }
    setMonth(targetMonth);
    setRows(json.rows);
  }

  async function onUpload(facilityId: string, slot: MediaSlot) {
    const key = fileKey(facilityId, slot);
    const file = fileByKey[key];
    if (!file) {
      setMessage("アップロードするファイルを選択してください。");
      return;
    }
    setBusy(true);
    setMessage("");
    const fd = new FormData();
    fd.append("facilityId", facilityId);
    fd.append("month", month);
    fd.append("slot", String(slot));
    fd.append("file", file);
    const res = await fetch("/api/admin/newsletters/upload", {
      method: "POST",
      body: fd,
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      if (json.error === "file_type_not_allowed" || json.error === "file_must_be_png") {
        setMessage("PNG / JPEG / PDF のいずれかを選択してください。");
      } else if (json.error === "file_too_large") {
        setMessage("ファイルサイズが大きすぎます（2MBまで）。");
      } else if (json.error === "empty_file") {
        setMessage(
          "ファイルの受信に失敗しました。サイズが大きすぎる可能性があります。再試行するか、管理者に連絡してください。"
        );
      } else if (res.status === 413) {
        setMessage("サーバー側の上限で拒否されました。nginx 等の設定を確認してください。");
      } else {
        setMessage("アップロードに失敗しました。");
      }
      return;
    }
    setFileByKey((prev) => ({ ...prev, [key]: null }));
    await reload(month);
    setMessage(slot === 1 ? "1枚目を保存しました。" : "追加の1枚を保存しました。");
  }

  async function onDelete(facilityId: string, slot: MediaSlot) {
    if (!confirm(slot === 1 ? "1枚目を削除します。よろしいですか？" : "追加の1枚を削除します。よろしいですか？")) {
      return;
    }
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/admin/newsletters", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId, month, slot }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage("削除に失敗しました。");
      return;
    }
    await reload(month);
    setMessage("削除しました。");
  }

  function renderSlot(row: Row, slot: MediaSlot) {
    const current = row.files.find((f) => f.slot === slot) ?? null;
    const key = fileKey(row.facilityId, slot);
    const previewFile = fileByKey[key];
    const label = slot === 1 ? "1枚目（本体）" : "2枚目（追加）";

    return (
      <div key={slot} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        {current ? (
          <>
            <p className="mt-1 text-xs text-slate-600">更新: {formatDateTimeJapan(current.uploadedAtIso)}</p>
            {current.mediaKind === "pdf" ? (
              <div className="mt-2 space-y-2">
                <MediaPreview url={current.imageUrl} kind="pdf" alt={`${row.facilityName} ${label}`} />
                <a
                  href={current.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"
                >
                  PDFを開く
                </a>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setZoom({ name: `${row.facilityName}（${label}）`, url: current.imageUrl, kind: "image" })}
                className="mt-2 block w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-2 text-left"
              >
                <MediaPreview url={current.imageUrl} kind="image" alt={`${row.facilityName} ${label}`} />
                <p className="mt-2 text-xs text-blue-700">クリックして拡大</p>
              </button>
            )}
          </>
        ) : (
          <p className="mt-1 text-xs text-slate-500">未登録</p>
        )}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="file"
            accept={ACCEPT}
            onChange={(e) =>
              setFileByKey((prev) => ({
                ...prev,
                [key]: e.target.files?.[0] ?? null,
              }))
            }
            className="w-full text-sm"
          />
          <button
            type="button"
            disabled={busy || !previewFile}
            onClick={() => onUpload(row.facilityId, slot)}
            className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {current ? "差し替え" : "登録"}
          </button>
          <button
            type="button"
            disabled={busy || !current}
            onClick={() => onDelete(row.facilityId, slot)}
            className="min-h-11 rounded-xl border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-700 disabled:opacity-50"
          >
            削除
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h1 className="text-lg font-bold text-slate-900">通信画像の管理</h1>
        <p className="mt-1 text-xs text-slate-600">
          事業所ごとに月別ファイル（PNG / JPEG / PDF）を登録します。基本は1枚、必要なら追加でもう1枚まで登録できます（各2MBまで）。
        </p>
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
        {rows.map((r) => (
          <section
            key={r.facilityId}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100"
          >
            <h2 className="text-base font-semibold text-slate-900">{r.facilityName}</h2>
            <div className="mt-3 grid grid-cols-1 gap-3">{renderSlot(r, 1)}{renderSlot(r, 2)}</div>
          </section>
        ))}
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
            <MediaPreview url={zoom.url} kind={zoom.kind} alt={`${zoom.name} 拡大`} className="h-auto w-full" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
