declare namespace Cloudflare {
  interface Env {
    APP_ENV?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
