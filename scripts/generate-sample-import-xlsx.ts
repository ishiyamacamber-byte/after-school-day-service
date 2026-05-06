/**
 * 利用者取込用サンプル Excel を samples/ に出力する。
 *   npx tsx scripts/generate-sample-import-xlsx.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";

const header = [
  "login_id",
  "name",
  "monthly_limit",
  "allowed_facilities",
  "management_no",
  "password",
  "default_sun",
  "default_mon",
  "default_tue",
  "default_wed",
  "default_thu",
  "default_fri",
  "default_sat",
] as const;

const rows: (string | number)[][] = [
  [...header],
  [
    "import_sample_01",
    "サンプル 花子",
    12,
    "オーパ|セカンド|サード|ネクスト|アスリート",
    9001,
    "password",
    "",
    "オーパ",
    "セカンド",
    "サード",
    "ネクスト",
    "アスリート",
    "",
  ],
  [
    "import_sample_02",
    "サンプル 太郎",
    20,
    "オーパ|チャレンジ|ステップ",
    9002,
    "",
    "",
    "オーパ",
    "オーパ",
    "チャレンジ",
    "ステップ",
    "オーパ",
    "ステップ",
  ],
];

const ws = XLSX.utils.aoa_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "利用者");

const outDir = path.join(process.cwd(), "samples");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "user-import-sample.xlsx");
fs.writeFileSync(outPath, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
console.log("Wrote", outPath);
