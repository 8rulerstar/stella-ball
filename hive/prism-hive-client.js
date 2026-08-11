/* Browser-side Hive boundary. Credentials never belong in this file. */
class PrismHiveClient {
  constructor(config = window.PRISM_HIVE_CONFIG ?? {}) {
    this.proxyUrl = String(config.proxyUrl ?? "").replace(/\/$/, "");
    this.enabled = Boolean(this.proxyUrl);
  }

  async request(path, options = {}) {
    if (!this.enabled)
      return { skipped: true, reason: "Hive proxy is not configured." };
    const response = await fetch(`${this.proxyUrl}${path}`, {
      headers: {
        "content-type": "application/json",
        ...(options.headers ?? {}),
      },
      ...options,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        body.message ?? `Hive proxy request failed (${response.status}).`,
      );
    return body;
  }

  beginLogin(returnUrl = window.location.href) {
    if (!this.enabled) return false;
    window.location.assign(
      `${this.proxyUrl}/login?returnUrl=${encodeURIComponent(returnUrl)}`,
    );
    return true;
  }

  submitRun(run) {
    return this.request("/runs", { method: "POST", body: JSON.stringify(run) });
  }

  getLeaderboard(metric) {
    return this.request(`/leaderboard?metric=${encodeURIComponent(metric)}`);
  }

  writeAndReadProbe(probe) {
    return this.request("/spike/write-read", {
      method: "POST",
      body: JSON.stringify(probe),
    });
  }
}

window.PrismHive = new PrismHiveClient();
