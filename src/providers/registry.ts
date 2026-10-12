// Every provider implements the Provider interface (see src/types):
//   id         — section id; also the key for "open by default" + cache
//   detect     — should this provider show up for this page/site?
//   load       — fetch whatever this provider edits
//   getSchema  — describe editable fields for the generic form renderer
//   save       — persist edited values back to WordPress
//
// New plugin support = one new file exporting a Provider, added to the list
// below. Nothing else in the extension needs to change.

import type { EntityRef, Provider } from '../types';
import { acfProvider } from './acf';
import { coreProvider } from './core';
import { frontPageProvider } from './front-page';
import { termCoreProvider } from './term-core';
import { termYoastProvider } from './term-yoast';
import { woocommerceProvider } from './woocommerce';
import { yoastProvider } from './yoast';

/** Order here = order of sections in the panel. */
export const allProviders: Provider[] = [
  coreProvider,
  termCoreProvider,
  acfProvider,
  woocommerceProvider,
  yoastProvider,
  termYoastProvider,
  frontPageProvider,
];

export function getProvidersFor(ctx: EntityRef, providers: Provider[] = allProviders): Provider[] {
  return providers.filter((p) => p.detect(ctx));
}
