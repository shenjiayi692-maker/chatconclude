import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const port = process.env.CDP_PORT || "9229";
const locale = process.argv[2] || "en-US";
const output = process.argv[3];

if (!output) {
  throw new Error("Usage: node scripts/capture-popup.mjs <locale> <output.png>");
}

const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
const worker = targets.find((target) => target.type === "service_worker" && target.url.startsWith("chrome-extension://"));
if (!worker) throw new Error("Could not find a loaded extension service worker");

const extensionId = new URL(worker.url).host;
const popupUrl = `chrome-extension://${extensionId}/src/popup/popup.html`;
const target = await fetch(
  `http://127.0.0.1:${port}/json/new?${encodeURIComponent(popupUrl)}`,
  { method: "PUT" },
).then((response) => response.json());

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let sequence = 0;

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function send(method, params = {}) {
  sequence += 1;
  return new Promise((resolve, reject) => {
    pending.set(sequence, { resolve, reject });
    socket.send(JSON.stringify({ id: sequence, method, params }));
  });
}

await send("Page.enable");
await send("Emulation.setLocaleOverride", { locale });
await send("Emulation.setDeviceMetricsOverride", {
  width: 340,
  height: 760,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.reload", { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 700));

const dimensions = await send("Runtime.evaluate", {
  expression: "({width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight})",
  returnByValue: true,
});
const { width, height } = dimensions.result.value;
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: 1,
  mobile: false,
});

const screenshot = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: true,
  fromSurface: true,
});

await mkdir(dirname(output), { recursive: true });
await writeFile(output, Buffer.from(screenshot.data, "base64"));
await send("Page.close");
socket.close();

console.log(`Captured ${locale}: ${output}`);
