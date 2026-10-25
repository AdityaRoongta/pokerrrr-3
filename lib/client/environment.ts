import { testToolsEnabled } from '../app-environment.mjs';

export const showTestTools = testToolsEnabled(
  process.env.NEXT_PUBLIC_APP_ENV,
  process.env.NODE_ENV
);
