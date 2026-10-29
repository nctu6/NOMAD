import type { AssistantAttachmentTextStatus } from '../../db/repositories/AssistantAttachments.repository';
import { logError } from '../audit/audit-log.logger';
import { withRequestContext } from '../database/request-context';
import { AllowedFileTypesService } from '../files/allowed-file-types.service';
import { isUploadTypeAllowed } from '../files/files.constants';
import { McpToolGuardsService } from '../mcp-shared/mcp-tool-guards.service';
import type { HeldCall } from './assistant-agent';
import { attachChipKeys, attachLine, hasLinkTargets, type AttachFacts } from './assistant-attach-answer';
import type { AttachedFileReader, FileRead } from './assistant-attached-file';
import { BOOKING_READ_REASONS, type BookingReadReason } from './assistant-booking-import.service';
import { todayIn, type TripCard } from './assistant-context';
import { AssistantToolsService } from './assistant-tools.service';
import { readTripCard } from './assistant-trip-scope';
import { AssistantWords } from './assistant-words';
import { AssistantCardContext } from './cards/card-context';
import type { UiStreamWriter } from './ui-stream.writer';
import { MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AssistantClientCtx, AssistantMessagePart } from '@trek/shared';

import { randomUUID } from 'node:crypto';

/** What the read step of an attached file answers when the file could not be read. */
const FILE_UNREADABLE = 'The file could not be read.';

/** The turn a file was attached in: who, on which trip, the thread, the answer's first row and the file kept. */
interface FileTurn extends AssistantClientCtx {
  userId: number;
  tripId: number;
  threadId: number;
  rowId: number;
  name: string;
  mime: string;
  /** How TREK's reading of the file's text went, when it was kept (AssistantAttachmentsService). */
  textStatus: AssistantAttachmentTextStatus;
}

/** How the answer's row is written: AssistantService's, which owns the rows and their transactions. */
export interface FileAnswerRows {
  save(parts: AssistantMessagePart[], status: 'complete' | 'aborted' | 'error'): Promise<void>;
  /** Saves the row waiting for the user, together with the changes it holds. */
  hold(parts: AssistantMessagePart[], held: HeldCall[]): Promise<void>;
}

/** Where the answer goes: the stream, the signal that the client went away, and the row. */
interface FileAnswerOut {
  w: UiStreamWriter;
  signal: AbortSignal;
  rows: FileAnswerRows;
}

/** A file that proposes nothing holds no change. */
const NOTHING_HELD: {
  held: HeldCall[];
  parts: AssistantMessagePart[];
  shown: ReadonlyMap<string, Record<string, unknown>>;
} = { held: [], parts: [], shown: new Map() };

/** The reason a read step names, when it is one this build knows. */
function reasonOf(found: Record<string, unknown>): BookingReadReason | null {
  const reason = found.reason;
  return (BOOKING_READ_REASONS as readonly unknown[]).includes(reason) ? (reason as BookingReadReason) : null;
}

/**
 * The answer to a file the user attached in the trip chat, written by the
 * server itself, in the answer's first row: the read step, then one held
 * change per booking (`import_booking`) or track (`import_tour_file`), each
 * with its card. A booking file is always answered with a line that names
 * what was found (or why nothing was) and chips with what to do with the
 * file next (assistant-attach-answer.ts). No model is asked.
 */
@Injectable()
export class AssistantFileAnswers {
  constructor(
    private readonly tools: AssistantToolsService,
    private readonly cardContext: AssistantCardContext,
    private readonly guards: McpToolGuardsService,
    private readonly allowedTypes: AllowedFileTypesService,
    private readonly orm: MikroORM,
  ) {}

  /**
   * Reads the attached file and proposes what it found. A file that cannot
   * be read ends the answer with `generic`; a route file without any track,
   * with its reader's code.
   *
   * @txIndependent the row is written once the file was read, in a
   * transaction of its own.
   */
  async answer(turn: FileTurn, file: Express.Multer.File, reader: AttachedFileReader, out: FileAnswerOut) {
    const { w, signal, rows } = out;
    const readId = randomUUID();
    const readArgs = { name: turn.name };
    const readPart = (result: unknown, isError = false): AssistantMessagePart => ({
      type: 'tool-call',
      toolCallId: readId,
      toolName: reader.readTool,
      args: readArgs,
      result,
      ...(isError ? { isError: true } : {}),
    });
    w.startStep();
    w.toolInput(readId, reader.readTool, readArgs);
    let read: FileRead;
    try {
      read = await withRequestContext(this.orm, () => reader.propose(turn.userId, turn.tripId, file));
    } catch (err) {
      logError(`[assistant] reading ${turn.name} failed: ${err instanceof Error ? err.message : String(err)}`);
      await rows.save([readPart(FILE_UNREADABLE, true)], 'error');
      w.toolError(readId, FILE_UNREADABLE);
      w.error('generic');
      w.finish('error');
      return;
    }
    const { found, proposals } = read;
    if (signal.aborted) {
      await rows.save([readPart(found)], 'aborted');
      w.abort();
      return;
    }
    w.toolOutput(readId, found);
    if (proposals.length === 0 && !reader.acknowledges) {
      await rows.save([readPart(found)], 'error');
      w.finishStep();
      w.error(reader.emptyCode);
      w.finish('error');
      return;
    }
    const card = await readTripCard(this.tools, turn.userId, turn.tripId);
    const said = reader.acknowledges ? await this.acknowledgement(turn, card, proposals.length, reasonOf(found)) : null;
    if (said) w.text(said.line);
    const held = proposals.length > 0 ? await this.held(turn, card, read) : NOTHING_HELD;
    const tail: AssistantMessagePart[] = said?.chips ? [{ type: 'data-trek-follow-ups', data: said.chips }] : [];
    const parts: AssistantMessagePart[] = [
      readPart(found),
      ...(said ? [{ type: 'text' as const, text: said.line }] : []),
      ...held.parts,
      ...tail,
    ];
    if (held.held.length > 0) await rows.hold(parts, held.held);
    else await rows.save(parts, 'complete');
    for (const change of held.held) {
      w.toolInput(change.id, change.toolName, held.shown.get(change.id) ?? change.args);
      w.approvalRequest(change.id);
      w.change(change.preview);
    }
    if (said?.chips) w.followUps(said.chips);
    w.finishStep();
    w.finish(held.held.length > 0 ? 'tool-calls' : 'stop');
  }

  /** The changes the file proposes, held with their cards, and the parts that show them. */
  private async held(turn: FileTurn, card: TripCard, read: FileRead) {
    const ctx = this.cardContext.contextOf(card, new Map(), turn.locale, todayIn(turn.timeZone, new Date()));
    const proposed = read.proposals.map((proposal) => ({ ...proposal, id: randomUUID() }));
    // The thread shows a call as the reader shows it; the held call keeps everything it runs with.
    const shown = new Map<string, Record<string, unknown>>(proposed.map((c) => [c.id, c.shownArgs ?? c.args]));
    const described = await this.cardContext.describeProposed(turn.userId, turn.tripId, ctx, proposed);
    const held: HeldCall[] = described.map((change) => ({ ...change, providerCallId: `import_${change.id}` }));
    const parts: AssistantMessagePart[] = [
      ...held.map((change): AssistantMessagePart => ({
        type: 'tool-call',
        toolCallId: change.id,
        toolName: change.toolName,
        args: shown.get(change.id) ?? change.args,
        approval: { id: change.id },
      })),
      ...held.map((change): AssistantMessagePart => ({ type: 'data-trek-change', data: change.preview })),
    ];
    return { held, parts, shown };
  }

  /** The answer's line and its chips, in the user's language; no chips when nothing fits. */
  private async acknowledgement(turn: FileTurn, card: TripCard, found: number, reason: BookingReadReason | null) {
    const words = await AssistantWords.of(turn.locale);
    const facts = await withRequestContext(this.orm, () => this.factsOf(turn, card, found));
    const questions = attachChipKeys(facts).map((key) => words.t(key));
    return {
      line: attachLine(words, turn.name, found, reason),
      chips: questions.length > 0 ? { questions } : null,
    };
  }

  /** What the chips are chosen from: the file, and the user's rights on the trip. */
  private async factsOf(turn: FileTurn, card: TripCard, found: number): Promise<AttachFacts> {
    const { userId, tripId } = turn;
    const [upload, edit, book, allowed] = await Promise.all([
      this.guards.hasTripPermission('file_upload', tripId, userId),
      this.guards.hasTripPermission('file_edit', tripId, userId),
      this.guards.hasTripPermission('reservation_edit', tripId, userId),
      this.allowedTypes.get(),
    ]);
    return {
      found,
      readable: turn.textStatus === 'ok',
      canKeep: upload && isUploadTypeAllowed(turn.name, turn.mime, allowed),
      canLink: edit,
      hasTargets: hasLinkTargets(card),
      canBook: book,
    };
  }
}
