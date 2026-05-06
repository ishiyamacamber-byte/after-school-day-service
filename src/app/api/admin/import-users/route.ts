import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decodeCsvUpload, parseCsv } from "@/lib/csv";
import { isExcelUpload, parseExcelFirstSheetToRows } from "@/lib/excel-import";

const weekdayColumns = [
  "default_sun",
  "default_mon",
  "default_tue",
  "default_wed",
  "default_thu",
  "default_fri",
  "default_sat",
] as const;

type HeaderMap = Record<string, number>;

function getCell(row: string[], map: HeaderMap, key: string): string {
  const idx = map[key];
  if (idx === undefined) return "";
  return row[idx]?.trim() ?? "";
}

function toHeaderMap(header: string[]): HeaderMap {
  const map: HeaderMap = {};
  header.forEach((h, i) => {
    const key = h.replace(/^\uFEFF/, "").trim().toLowerCase();
    if (key) map[key] = i;
  });
  return map;
}

async function getNextAvailableManagementNumber(): Promise<number> {
  const agg = await prisma.user.aggregate({
    where: { role: "USER" },
    _max: { managementNumber: true },
  });
  return (agg._max.managementNumber ?? 0) + 1;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }

  const useRowOrder = form.get("useRowOrder") === "1";
  const rowOrderStartRaw = form.get("rowOrderStart");
  const rowOrderStart = Math.max(
    1,
    parseInt(String(rowOrderStartRaw ?? "1"), 10) || 1
  );

  const buf = await file.arrayBuffer();
  let rows: string[][];
  if (isExcelUpload(file)) {
    try {
      rows = parseExcelFirstSheetToRows(buf);
    } catch {
      return NextResponse.json({ error: "invalid_spreadsheet" }, { status: 400 });
    }
  } else {
    rows = parseCsv(decodeCsvUpload(buf));
  }
  if (rows.length < 2) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }

  const headerMap = toHeaderMap(rows[0]);
  const required = ["login_id", "name", "monthly_limit", "allowed_facilities"];
  for (const key of required) {
    if (headerMap[key] === undefined) {
      return NextResponse.json({ error: `missing_column:${key}` }, { status: 400 });
    }
  }

  const hasMgmtColumn = headerMap["management_no"] !== undefined;

  const facilities = await prisma.facility.findMany({
    select: { id: true, name: true },
  });
  const idByName = new Map(facilities.map((f) => [f.name, f.id]));
  const validIds = new Set(facilities.map((f) => f.id));

  const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 1;
    const loginId = getCell(row, headerMap, "login_id");
    const name = getCell(row, headerMap, "name");
    const monthlyLimitRaw = getCell(row, headerMap, "monthly_limit");
    const allowedRaw = getCell(row, headerMap, "allowed_facilities");
    const passwordRaw = getCell(row, headerMap, "password");

    if (!loginId || !name || !monthlyLimitRaw) {
      result.skipped++;
      result.errors.push(`line ${line}: login_id/name/monthly_limit は必須です`);
      continue;
    }
    const monthlyLimit = Number(monthlyLimitRaw);
    if (!Number.isFinite(monthlyLimit) || monthlyLimit < 0 || monthlyLimit > 31) {
      result.skipped++;
      result.errors.push(`line ${line}: monthly_limit は 0-31 の数値にしてください`);
      continue;
    }

    const allowedFacilityIds = allowedRaw
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((v) => (validIds.has(v) ? v : idByName.get(v) ?? ""))
      .filter(Boolean);

    if (allowedFacilityIds.length === 0) {
      result.skipped++;
      result.errors.push(
        `line ${line}: allowed_facilities は事業所IDまたは事業所名を | 区切りで指定してください`
      );
      continue;
    }

    const defaultSchedule: Record<string, string> = {};
    let scheduleOk = true;
    for (let d = 0; d < 7; d++) {
      const raw = getCell(row, headerMap, weekdayColumns[d]);
      if (!raw) continue;
      const fid = validIds.has(raw) ? raw : idByName.get(raw) ?? "";
      if (!fid) {
        result.errors.push(`line ${line}: ${weekdayColumns[d]} の値 "${raw}" が不正です`);
        scheduleOk = false;
        break;
      }
      if (!allowedFacilityIds.includes(fid)) {
        result.errors.push(
          `line ${line}: ${weekdayColumns[d]} は allowed_facilities 内の事業所を指定してください`
        );
        scheduleOk = false;
        break;
      }
      defaultSchedule[String(d)] = fid;
    }
    if (!scheduleOk) {
      result.skipped++;
      continue;
    }

    let desiredMgmtFromCsv: number | undefined;
    if (hasMgmtColumn) {
      const rawMgmt = getCell(row, headerMap, "management_no");
      if (rawMgmt) {
        const n = parseInt(rawMgmt, 10);
        if (!Number.isFinite(n) || n < 1) {
          result.skipped++;
          result.errors.push(`line ${line}: management_no は 1 以上の整数にしてください`);
          continue;
        }
        desiredMgmtFromCsv = n;
      }
    }

    const existing = await prisma.user.findUnique({ where: { loginId } });

    let managementNumber: number;
    if (desiredMgmtFromCsv !== undefined) {
      managementNumber = desiredMgmtFromCsv;
    } else if (useRowOrder) {
      managementNumber = rowOrderStart + (i - 1);
    } else if (existing?.managementNumber != null) {
      managementNumber = existing.managementNumber;
    } else {
      managementNumber = await getNextAvailableManagementNumber();
    }

    const conflict = await prisma.user.findFirst({
      where: {
        role: "USER",
        managementNumber,
        ...(existing ? { id: { not: existing.id } } : {}),
      },
    });
    if (conflict) {
      result.skipped++;
      result.errors.push(
        `line ${line}: 管理番号 ${managementNumber} は既に利用者「${conflict.name}」（${conflict.loginId}）に割り当てられています`
      );
      continue;
    }

    if (existing) {
      await prisma.user.update({
        where: { loginId },
        data: {
          name,
          monthlyLimit,
          defaultSchedule: JSON.stringify(defaultSchedule),
          allowedFacilityIds: JSON.stringify(allowedFacilityIds),
          managementNumber,
        },
      });
      result.updated++;
    } else {
      const defaultPassword = passwordRaw || "password";
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      await prisma.user.create({
        data: {
          loginId,
          name,
          passwordHash,
          monthlyLimit,
          defaultSchedule: JSON.stringify(defaultSchedule),
          allowedFacilityIds: JSON.stringify(allowedFacilityIds),
          managementNumber,
          role: "USER",
        },
      });
      result.created++;
    }
  }

  return NextResponse.json({ ok: true, ...result });
}
