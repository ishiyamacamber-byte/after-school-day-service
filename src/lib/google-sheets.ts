/**
 * 申請データを Google スプレッドシートに追記する。
 * 環境変数が未設定の場合は no-op（開発用）。
 */
export type SheetRow = {
  submittedAtIso: string;
  userName: string;
  loginId: string;
  groupId: string;
  date: string | "(全体)";
  facilityName: string;
  notes: string;
};

export async function appendApplicationRows(rows: SheetRow[]): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const range = process.env.GOOGLE_SHEETS_RANGE ?? "Sheet1!A1";
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!spreadsheetId || !email || !privateKey) {
    console.warn(
      "[google-sheets] 環境変数が未設定のためスキップしました。GOOGLE_SHEETS_SPREADSHEET_ID / GOOGLE_SERVICE_ACCOUNT_* を設定してください。"
    );
    return;
  }

  const { google } = await import("googleapis");
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const values = rows.map((r) => [
    r.submittedAtIso,
    r.userName,
    r.loginId,
    r.groupId,
    r.date,
    r.facilityName,
    r.notes,
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}
