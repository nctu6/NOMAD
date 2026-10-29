import type { CardView } from '../cardTypes';
import { JournalChatBlock } from './JournalChatBlock';
import { TripChatBlock } from './TripChatBlock';

/**
 * How the home chat's kinds draw: the trip or the journal it offers to go on
 * with, beside the answer. This file only maps the kind to its view; the component lives
 * in a sibling file, since a file that exports anything besides components
 * breaks fast refresh.
 */
export const HOME_VIEWS = {
  tripChat: { Block: TripChatBlock },
  journalChat: { Block: JournalChatBlock },
} satisfies { [K in 'tripChat' | 'journalChat']: CardView<K> };
