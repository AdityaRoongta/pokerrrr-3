import { notFound } from 'next/navigation';
import { LayoutHarness } from './layout-harness';
import { testToolsEnabled } from '../../lib/app-environment.mjs';
export default function LayoutCheck() {
  if (!testToolsEnabled(process.env.NEXT_PUBLIC_APP_ENV, process.env.NODE_ENV)) notFound();
  return <LayoutHarness />;
}
