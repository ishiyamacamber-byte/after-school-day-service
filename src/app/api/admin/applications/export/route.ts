import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function monthRange(month: string | null) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    month = `${yyyy}-${mm}`;
  }
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0);
  return { month, start, end };
}

function csvCell(v: string) {
  const escaped = v.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

type Agg = {
  userName: string;
  loginId: string;
  dayFacilities: Record<number, string[]>;
  overallNotes: string[];
  dailyNotes: string[];
};

type ExportRowUser = {
  id: string;
  name: string;
  loginId: string;
  managementNumber: number | null;
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return new Response("forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? "";
  const q = (searchParams.get("q") ?? "").trim();
  const { month, start, end } = monthRange(searchParams.get("month"));

  const [appRows, users] = await Promise.all([
    prisma.application.findMany({
      where: {
        submittedAt: { gte: start, lt: end },
        ...(userId ? { userId } : {}),
      },
      orderBy: [{ submittedAt: "desc" }, { date: "asc" }],
      include: {
        user: { select: { name: true, loginId: true } },
        facility: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        role: "USER",
        ...(userId ? { id: userId } : {}),
      },
      select: {
        id: true,
        name: true,
        loginId: true,
        managementNumber: true,
      },
    }),
  ]);

  const byUser = new Map<string, Agg>();

  for (const r of appRows) {
    const cur = byUser.get(r.userId) ?? {
      userName: r.user.name,
      loginId: r.user.loginId,
      dayFacilities: {},
      overallNotes: [],
      dailyNotes: [],
    };
    if (r.date) {
      const day = r.date.getDate();
      const name = r.facility?.name ?? "";
      if (name) {
        const list = cur.dayFacilities[day] ?? [];
        if (!list.includes(name)) list.push(name);
        cur.dayFacilities[day] = list;
      }
      if (r.notes?.trim()) cur.dailyNotes.push(`${day}日: ${r.notes.trim()}`);
    } else if (r.notes?.trim()) {
      cur.overallNotes.push(r.notes.trim());
    }
    byUser.set(r.userId, cur);
  }

  let list = [...users];
  if (q) {
    const ql = q.toLowerCase();
    list = list.filter(
      (u) => u.name.toLowerCase().includes(ql) || u.loginId.toLowerCase().includes(ql)
    );
  }
  const sorted = [...list].sort((a, b) => {
    if (a.managementNumber == null && b.managementNumber == null) {
      return a.loginId.localeCompare(b.loginId);
    }
    if (a.managementNumber == null) return 1;
    if (b.managementNumber == null) return -1;
    if (a.managementNumber !== b.managementNumber) return a.managementNumber - b.managementNumber;
    return a.loginId.localeCompare(b.loginId);
  });

  // 「詰めない」要件: management_no は 1..max の連番で出力し、欠番は空行を挿入する。
  // userId / q で絞り込んだ場合は欠番補完を行わず、対象ユーザーのみを出力する。
  const shouldKeepNumberSlots = !userId && !q;
  const exportRows: ExportRowUser[] = shouldKeepNumberSlots
    ? (() => {
        const map = new Map<number, ExportRowUser>();
        const noMgmt: ExportRowUser[] = [];
        for (const u of sorted) {
          if (u.managementNumber == null) {
            noMgmt.push(u);
            continue;
          }
          map.set(u.managementNumber, u);
        }
        const maxNo = Math.max(0, ...map.keys());
        const rows: ExportRowUser[] = [];
        for (let no = 1; no <= maxNo; no++) {
          rows.push(
            map.get(no) ?? { id: `slot-${no}`, name: "", loginId: "", managementNumber: no }
          );
        }
        rows.push(...noMgmt);
        return rows;
      })()
    : sorted;

  const header = [
    "管理番号",
    "名前",
    "ログインID",
    ...Array.from({ length: 31 }, (_, i) => String(i + 1)),
    "全体連絡事項",
    "日別連絡事項",
  ];

  const lines = [header.map(csvCell).join(",")];

  for (const u of exportRows) {
    const agg =
      byUser.get(u.id) ??
      ({
        userName: u.name,
        loginId: u.loginId,
        dayFacilities: {},
        overallNotes: [],
        dailyNotes: [],
      } satisfies Agg);

    const dayCells = Array.from({ length: 31 }, (_, i) => agg.dayFacilities[i + 1]?.join(" / ") ?? "");
    const mgmt = u.managementNumber != null ? String(u.managementNumber) : "";

    lines.push(
      [mgmt, agg.userName, agg.loginId, ...dayCells, agg.overallNotes.join(" / "), agg.dailyNotes.join(" / ")]
        .map((v) => csvCell(String(v)))
        .join(",")
    );
  }

  const bom = "\uFEFF";
  const body = bom + lines.join("\r\n");
  const filename = `applications-${month}.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
