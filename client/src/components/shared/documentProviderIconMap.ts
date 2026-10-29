import type React from 'react';
import {
  type GlyphProps,
  NextcloudIcon,
  OpenCloudIcon,
  PaperlessIcon,
  PapraIcon,
  SynologyDriveIcon,
} from './DocumentProviderIcons';

/**
 * The document providers' marks keyed by the provider ids in `document_providers`.
 * Kept apart from the drawings so that module exports components only.
 */
export const DOCUMENT_PROVIDER_ICONS: Record<string, React.ComponentType<GlyphProps>> = {
  paperless: PaperlessIcon,
  papra: PapraIcon,
  nextcloud: NextcloudIcon,
  opencloud: OpenCloudIcon,
  synologydrive: SynologyDriveIcon,
};
