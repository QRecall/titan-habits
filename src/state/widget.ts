// Script de Scriptable para el widget de racha. Lee GET /today del Worker.

export function widgetScript(workerUrl: string, id: string, appUrl: string): string {
  const dataUrl = JSON.stringify(`${workerUrl}/today?id=${id}`);
  return `// TITAN · widget de racha para Scriptable
// Pega este script en Scriptable y añade un widget pequeño que lo use.
const DATA_URL = ${dataUrl};
const APP_URL = ${JSON.stringify(appUrl)};

let data = null;
try {
  const req = new Request(DATA_URL);
  req.timeoutInterval = 10;
  data = await req.loadJSON();
} catch (e) {}

const found = !!(data && data.found);
const streak = found ? data.streak : null;
const pending = found ? data.pending : null;

const w = new ListWidget();
w.backgroundColor = new Color("#0B0B0D");
w.url = APP_URL;
w.setPadding(14, 14, 14, 14);

const flame = w.addText("🔥");
flame.font = Font.systemFont(26);
flame.textOpacity = streak > 0 ? 1 : 0.35;

w.addSpacer(2);
const num = w.addText(streak === null ? "—" : String(streak));
num.font = Font.boldSystemFont(46);
num.minimumScaleFactor = 0.5;
num.textColor = streak > 0 ? new Color("#EFC66A") : new Color("#86847B");

const unit = w.addText(streak === 1 ? "día de racha" : "días de racha");
unit.font = Font.mediumSystemFont(12);
unit.textColor = new Color("#A9A69C");

w.addSpacer();
let line;
if (!data) line = "sin conexión";
else if (!found) line = "abre TITAN";
else if (pending === null) line = "firma el contrato";
else if (pending === 0) line = "todo hecho hoy";
else line = pending + (pending === 1 ? " pendiente hoy" : " pendientes hoy");
const foot = w.addText(line);
foot.font = Font.semiboldSystemFont(13);
foot.textColor = pending === 0 ? new Color("#7FA76A") : new Color("#F5F1E8");

w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(w);
else await w.presentSmall();
Script.complete();
`;
}
