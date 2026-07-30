/**
 * Socket churn probe.
 *
 *   node scripts/ws-watch.mjs            # defaults to http://localhost:3000
 *   node scripts/ws-watch.mjs http://localhost:3000
 *
 * Polls /wsz once a second and prints a line only when something CHANGES.
 * Run it while reproducing the disconnect, then read the output:
 *
 *   RESTART lines appear          → the server process is dying and coming back.
 *                                   The disconnects are collateral; fix the crash.
 *   pid/uptime steady, but the    → the server is fine. The sockets are being
 *   driver/rider counts drop        killed by the network or the client
 *                                   (emulator NAT, app backgrounding, Wi-Fi).
 *   the probe itself errors       → the server is unreachable at that moment,
 *   during the drop                 which is a restart or a bind/port problem.
 */
const BASE = process.argv[2] ?? 'http://localhost:3000';
const URL_WSZ = `${BASE.replace(/\/$/, '')}/wsz`;

let last = null;

function stamp() {
  return new Date().toISOString().slice(11, 23);
}

async function tick() {
  let body;
  try {
    const res = await fetch(URL_WSZ);
    body = await res.json();
  } catch (err) {
    if (last !== 'DOWN') {
      console.log(`${stamp()}  UNREACHABLE  ${err.message}`);
      last = 'DOWN';
    }
    return;
  }

  const { pid, uptimeSec, ws } = body;
  const key = `${pid}|${ws.drivers}|${ws.riders}|${ws.sockets}|${ws.driverEntries}|${ws.riderEntries}`;

  if (last === 'DOWN') {
    console.log(`${stamp()}  BACK UP      pid=${pid} uptime=${uptimeSec}s`);
    last = null;
  }

  // A restart is the headline: same port, new pid, uptime back near zero.
  if (last && last.pid !== undefined && last.pid !== pid) {
    console.log(
      `${stamp()}  *** RESTART *** pid ${last.pid} → ${pid} (uptime=${uptimeSec}s) ` +
      `— the server died; socket drops are a symptom, not the cause`,
    );
  } else if (last && uptimeSec < (last.uptimeSec ?? 0)) {
    // Same pid but uptime went backwards shouldn't happen; guard anyway.
    console.log(`${stamp()}  *** RESTART *** uptime reset ${last.uptimeSec}s → ${uptimeSec}s`);
  }

  if (!last || last.key !== key) {
    console.log(
      `${stamp()}  pid=${pid} uptime=${String(uptimeSec).padStart(4)}s  ` +
      `drivers=${ws.drivers} riders=${ws.riders} rawSockets=${ws.sockets}  ` +
      `entries=${ws.driverEntries}d/${ws.riderEntries}r`,
    );
  }

  last = { pid, uptimeSec, key };
}

console.log(`watching ${URL_WSZ} — printing only on change. Ctrl-C to stop.`);
await tick();
setInterval(tick, 1_000);
