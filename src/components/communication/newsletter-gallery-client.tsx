"use client";

import { useState } from "react";
import { formatDateTimeJapan } from "@/lib/datetime-japan";

type Row = {
  facilityId: string;
  facilityName: string;
  imageUrl: string;
  uploadedAtIso: string | null;
};

export function NewsletterGalleryClient({ month, rows }: { month: string; rows: Row[] }) {
  const [zoom, setZoom] = useState<{ name: string; url: string } | null>(null);

  return (
    <>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600 shadow-sm ring-1 ring-slate-100">
          この月に表示できる通信はありません。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {rows.map((r) => (
            <section
              key={r.facilityId}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100"
            >
              <h2 className="text-base font-semibold text-slate-900">{r.facilityName}</h2>
              {r.uploadedAtIso ? (
                <p className="mt-1 text-xs text-slate-600">更新: {formatDateTimeJapan(r.uploadedAtIso)}</p>
              ) : null}
              <button
                type="button"
                onClick={() => setZoom({ name: r.facilityName, url: r.imageUrl })}
                className="mt-3 block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 text-left"
              >
                <img src={r.imageUrl} alt={`${r.facilityName} ${month} 通信`} className="h-auto w-full" />
                <p className="mt-2 text-xs text-blue-700">クリックして拡大</p>
              </button>
            </section>
          ))}
        </div>
      )}

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
    </>
  );
}
