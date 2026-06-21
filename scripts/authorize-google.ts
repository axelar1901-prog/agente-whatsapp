import "./env-loader";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { google } from "googleapis";

const CREDENTIALS_PATH = path.resolve(process.cwd(), "google-credentials.json");
const TOKEN_PATH = path.resolve(process.cwd(), "google-token.json");
const SCOPES = ["https://www.googleapis.com/auth/calendar"];

async function main() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
  const { client_id, client_secret, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  const authUrl = oAuth2Client.generateAuthUrl({ access_type: "offline", scope: SCOPES });

  console.log("\n🔗 Abre este link en tu navegador:\n");
  console.log(authUrl);
  console.log("\nDespués de autorizar, Google te dará un código. Pégalo aquí:\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.question("Código: ", async (code) => {
    rl.close();
    const { tokens } = await oAuth2Client.getToken(code.trim());
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log("\n✅ Token guardado en google-token.json — ya puedes usar Google Calendar.\n");
  });
}

main().catch(console.error);
