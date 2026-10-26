// Transactional storage double: rollback and serialization model the coordinator.
export class MemoryStorage {
  values = new Map(); alarm = null; queue = Promise.resolve();
  async get(key) { return structuredClone(this.values.get(key)); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = '', limit = 1000, startAfter, end, reverse = false } = {}) {
    const rows = [...this.values].filter(([k]) => k.startsWith(prefix) && (!startAfter || k > startAfter) && (!end || k < end)).sort(([a], [b]) => a.localeCompare(b));
    if (reverse) rows.reverse();
    return new Map(rows.slice(0, limit).map(([k, v]) => [k, structuredClone(v)]));
  }
  async getAlarm() { return this.alarm; }
  async setAlarm(at) { this.alarm = at; }
  async deleteAlarm() { this.alarm = null; }
  transaction(work) {
    const result = this.queue.then(async () => {
      const before = structuredClone(this.values), alarm = this.alarm;
      try { return await work(this); } catch (e) { this.values = before; this.alarm = alarm; throw e; }
    });
    this.queue = result.catch(() => {}); return result;
  }
}
