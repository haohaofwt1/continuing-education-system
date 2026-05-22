import net from "node:net";
import fs from "node:fs";

const envFile = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
const envDatabaseUrl = envFile
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) => line.startsWith("DATABASE_URL="))
  ?.replace(/^DATABASE_URL=/, "")
  .replace(/^"|"$/g, "");
const databaseUrl = process.env.DATABASE_URL || envDatabaseUrl;

if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

let url;
try {
  url = new URL(databaseUrl);
} catch {
  console.error("DATABASE_URL is invalid.");
  process.exit(1);
}

const host = url.hostname || "localhost";
const port = Number(url.port || 5432);
const socket = net.createConnection({ host, port });

const timer = setTimeout(() => {
  socket.destroy();
  console.error(`PostgreSQL is not reachable at ${host}:${port}.`);
  process.exit(1);
}, 2500);

socket.on("connect", () => {
  clearTimeout(timer);
  socket.end();
  console.log(`PostgreSQL is reachable at ${host}:${port}.`);
});

socket.on("error", () => {
  clearTimeout(timer);
  console.error(`PostgreSQL is not reachable at ${host}:${port}.`);
  process.exit(1);
});
