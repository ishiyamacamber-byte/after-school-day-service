import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FACILITY_LIST_ORDER_BY } from "@/lib/facility-order";
import { formatDateYmdJapan } from "@/lib/datetime-japan";
import { NewsletterGalleryClient } from "@/components/communication/newsletter-gallery-client";

function monthLabelJa(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}年${m}月`;
}

export default async function CommunicationPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const sp = await searchParams;
  const currentMonth = formatDateYmdJapan(new Date()).slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? (sp.month as string) : currentMonth;

  const [facilities, rows] = await Promise.all([
    prisma.facility.findMany({
      select: { id: true, name: true },
      orderBy: FACILITY_LIST_ORDER_BY,
    }),
    prisma.facilityMonthlyNewsletterImage.findMany({
      where: { month },
      select: { facilityId: true, uploadedAt: true },
    }),
  ]);
  const byFacility = new Map(rows.map((r) => [r.facilityId, r]));

  const galleryRows = facilities
    .map((f) => {
      const row = byFacility.get(f.id);
      if (!row) return null;
      return {
        facilityId: f.id,
        facilityName: f.name,
        uploadedAtIso: row.uploadedAt.toISOString(),
        imageUrl: `/api/newsletters/image?facilityId=${encodeURIComponent(f.id)}&month=${encodeURIComponent(month)}`,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold leading-relaxed text-red-700">
        掲載されている写真や内容につきましては、個人情報保護の観点から、転載・SNS等への投稿はお控えください。
      </p>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h1 className="text-lg font-bold text-slate-900">通信</h1>
        <p className="mt-1 text-xs text-slate-600">
          事業所ごとの通信（PNG）です。利用設定に関係なく、すべての事業所で登録されたものを表示します。
        </p>
        <form method="GET" className="mt-3 flex items-center gap-2">
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
          />
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
          >
            表示
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-600">
          表示中: {monthLabelJa(month)}（{month}）
        </p>
      </div>

      <NewsletterGalleryClient month={month} rows={galleryRows} />
    </div>
  );
}
