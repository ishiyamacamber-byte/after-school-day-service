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
        className={className ?? "h-[28rem] w-full rounded-lg border border-slate-200 bg-white"}
      />
    );
  }
  return <img src={url} alt={alt} className={className ?? "h-auto w-full"} />;
}

export function ScheduleGalleryClient({ month, rows }: { month: string; rows: Row[] }) {
  const [zoom, setZoom] = useState<{ name: string; url: string; kind: MediaKind } | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-3">
        {rows.map((r) => (
          <section
            key={r.facilityId}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100"
          >
            <h2 className="text-base font-semibold text-slate-900">{r.facilityName}</h2>
            {r.files.length > 0 ? (
              <div className="mt-3 space-y-4">
                {r.files.map((file) => {
                  const label = file.slot === 1 ? "1枚目" : "追加";
                  return (
                    <div key={file.slot}>
                      <p className="text-xs font-medium text-slate-600">
                        {label}
                        {file.uploadedAtIso ? ` · 更新 ${formatDateTimeJapan(file.uploadedAtIso)}` : ""}
                      </p>
                      {file.mediaKind === "pdf" ? (
                        <div className="mt-2 space-y-2">
                          <MediaPreview
                            url={file.imageUrl}
                            kind="pdf"
                            alt={`${r.facilityName} ${month} ${label}`}
                          />
                          <a
                            href={file.imageUrl}
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
                          onClick={() =>
                            setZoom({
                              name: `${r.facilityName}（${label}）`,
                              url: file.imageUrl,
                              kind: "image",
                            })
                          }
                          className="mt-2 block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 text-left"
                        >
                          <MediaPreview
                            url={file.imageUrl}
                            kind="image"
                            alt={`${r.facilityName} ${month} ${label}`}
                          />
                          <p className="mt-2 text-xs text-blue-700">クリックして拡大</p>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">この月の画像はまだ登録されていません。</p>
            )}
          </section>
        ))}
      </div>

      {zoom ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setZoom(null)}>
          <div className="max-h-[95vh] w-full max-w-5xl overflow-auto rounded-xl bg-white p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">{zoom.name}</p>
              <button type="button" onClick={() => setZoom(null)} className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100">
                閉じる
              </button>
            </div>
            <MediaPreview url={zoom.url} kind={zoom.kind} alt={`${zoom.name} 拡大`} className="h-auto w-full" />
          </div>
        </div>
      ) : null}
    </>
  );
}
