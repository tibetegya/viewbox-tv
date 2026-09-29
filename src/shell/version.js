// Version helpers shared by the page (updates.js) and the .wgt service (wgt/service.js).

// "0.7.1" > "0.7.0"? Ignores a leading "v" and anything after a "-".
export function semverGt(a, b) {
  const parts = (v) => String(v || '0').replace(/^v/, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

// What the app can do about the latest release: nothing, hot-update the interface, or ask for a reinstall (the
// release needs a newer .wgt service than the one installed).
export function updateStatus(current, latest, installedService) {
  if (!latest || !semverGt(latest.version, current)) return { available: false, needsReinstall: false };
  return { available: true, needsReinstall: (latest.viewboxService || 1) > (installedService || 1) };
}
