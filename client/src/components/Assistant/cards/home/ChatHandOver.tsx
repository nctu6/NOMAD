import { ArrowRight, MessageSquareText } from 'lucide-react';

import { useTranslation } from '../../../../i18n';
import { type AssistantChatTrip, useAssistantView } from '../../assistantViewContext';

/**
 * What the home chat's cards that go on in another chat share: the question
 * handed over, waiting there ready to send, and the button that switches to
 * that chat. The button shows only where a chat can be switched to.
 */

/** The question that waits in the other chat's composer. */
export function HandedQuestion({ question }: { question: string | null }) {
  const { t } = useTranslation();
  if (!question) return null;
  return (
    <p className="m-0 flex items-start gap-2 rounded-lg bg-surface-secondary px-3 py-2 text-body text-content">
      <MessageSquareText size={14} aria-hidden="true" className="mt-0.5 flex-none text-content-muted" />
      <span className="sr-only">{t('assistant.card.tripChat.question')}</span>
      <bdi className="min-w-0 flex-1 break-words">{question}</bdi>
    </p>
  );
}

/** The button that goes on in the chat under `chat`, with the question handed over. */
export function OpenChatButton({
  chat,
  question,
  label,
}: {
  chat: AssistantChatTrip;
  question: string | null;
  label: string;
}) {
  const { onOpenTripChat, variant } = useAssistantView();
  if (!onOpenTripChat) return null;
  return (
    <button
      type="button"
      onClick={() => onOpenTripChat(chat, question)}
      className={`mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 text-body font-semibold text-accent-text transition-colors hover:bg-accent-hover ${
        variant === 'fullscreen' ? 'h-11' : 'h-9'
      }`}
    >
      {label}
      <ArrowRight size={15} aria-hidden="true" className="rtl:-scale-x-100" />
    </button>
  );
}
