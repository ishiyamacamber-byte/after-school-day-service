import iconv from "iconv-lite";

/**
 * アップロードされた CSV のバイト列を文字列にする。
 * - UTF-8（BOM あり/なし）
 * - UTF-16 LE（BOM 付き、Excel の「Unicode テキスト」系）
 * - CP932（Shift_JIS、Excel の「CSV」保存が多い）
 */
export function decodeCsvUpload(buffer: ArrayBuffer): string {
  const buf = Buffer.from(buffer);

  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return stripLeadingBom(buf.subarray(3).toString("utf8"));
  }

  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return stripLeadingBom(buf.subarray(2).toString("utf16le"));
  }

  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const body = buf.subarray(2);
    const swapped = Buffer.alloc(body.length);
    for (let i = 0; i + 1 < body.length; i += 2) {
      swapped[i] = body[i + 1]!;
      swapped[i + 1] = body[i]!;
    }
    return stripLeadingBom(swapped.toString("utf16le"));
  }

  const asUtf8 = buf.toString("utf8");
  const replacementCount = asUtf8.match(/\uFFFD/g)?.length ?? 0;
  if (replacementCount === 0) {
    return stripLeadingBom(asUtf8);
  }

  return stripLeadingBom(iconv.decode(buf, "cp932"));
}

function stripLeadingBom(s: string): string {
  return s.length > 0 && s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === "\"") {
        if (text[i + 1] === "\"") {
          cell += "\"";
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === "\"") {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch !== "\r") {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.length > 0));
}

