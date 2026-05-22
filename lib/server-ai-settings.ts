import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type ServerAiSettings = {
  openaiApiKey?: string;
  openaiModel?: string;
};

const settingsPath = path.join(process.cwd(), ".data", "ai-settings.json");

export async function getServerAiSettings(): Promise<ServerAiSettings> {
  try {
    const raw = await readFile(settingsPath, "utf8");
    return JSON.parse(raw) as ServerAiSettings;
  } catch {
    return {};
  }
}

export async function saveServerAiSettings(settings: ServerAiSettings) {
  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
}

export function maskSecret(value?: string) {
  if (!value) return "";
  if (value.length <= 10) return "••••";
  return `${value.slice(0, 7)}••••${value.slice(-4)}`;
}
