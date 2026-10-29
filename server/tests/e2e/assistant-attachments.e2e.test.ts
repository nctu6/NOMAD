/**
 * A file attached in the trip chat, end to end: the whole app with an instance
 * connection of kind `custom` pointing at a fake OpenAI-compatible server on
 * loopback, as in assistant.e2e.test.ts. The booking import's extractor (an
 * external binary) is stubbed on BookingImportService; storage and the text
 * reading are the real ones.
 *
 * Covered: the file is kept with its conversation (a row and its bytes) under
 * the id its message part carries, and goes with the thread; a storage that
 * refuses the bytes refuses the turn before anything is written; a file
 * without a booking is answered with a line that says why and chips, in the
 * user's language, never with an error; the model reads a file only after
 * the user agreed on its card, its text reaching the model and nothing else,
 * and proposes the booking from it; an attachment of another conversation is
 * answered like one that does not exist; a file is kept in Files with the
 * booking it belongs to, with the rights of Files, and only once.
 */
import { buildApp } from '../../src/bootstrap';
import { AssistantAttachments } from '../../src/db/entities/AssistantAttachments.entity';
import { AssistantMessages } from '../../src/db/entities/AssistantMessages.entity';
import { AssistantThreads } from '../../src/db/entities/AssistantThreads.entity';
import { BookingImportService } from '../../src/nest/booking-import/booking-import.service';
import { DemoService } from '../../src/nest/common/demo.service';
import { PermissionsService } from '../../src/nest/permissions/permissions.service';
import { StorageService } from '../../src/nest/storage/storage.service';
import { makeReservation } from '../helpers/factories/reservations';
import { countRows, findRow, findRows } from '../helpers/factories/rows';
import { setAddonEnabled } from '../helpers/factories/settings';
import { makeTrip } from '../helpers/factories/trips';
import { makeUser } from '../helpers/factories/users';
import { spyOnRealtime, type RealtimeSpies } from '../helpers/fake-realtime';
import { resetRateLimits } from '../helpers/test-db';
import { sessionCookie } from './harness';
import { MikroORM } from '@mikro-orm/core';
import type { INestApplication } from '@nestjs/common';
import type { BookingImportPreviewResponse, UiStreamChunk } from '@trek/shared';

import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ── The fake provider ─────────────────────────────────────────────────────────

interface ChatBody {
  model: string;
  messages: Array<{ role: string; content: string | null; tool_call_id?: string; tool_calls?: unknown[] }>;
  tools?: Array<{ function: { name: string; parameters: { properties?: Record<string, unknown> } } }>;
}

type Step = (body: ChatBody) => { chunks: object[] };

const provider = { requests: [] as ChatBody[], script: [] as Step[] };

const say =
  (text: string): Step =>
  () => ({
    chunks: [
      { choices: [{ index: 0, delta: { content: text } }] },
      { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
      { choices: [], usage: { prompt_tokens: 12, completion_tokens: 4 } },
    ],
  });

const callTools =
  (...calls: Array<{ id: string; name: string; args: Record<string, unknown> }>): Step =>
  () => ({
    chunks: [
      {
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: calls.map((call, index) => ({
                index,
                id: call.id,
                type: 'function',
                function: { name: call.name, arguments: JSON.stringify(call.args) },
              })),
            },
          },
        ],
      },
      { choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] },
    ],
  });

async function readBody(req: IncomingMessage): Promise<string> {
  let text = '';
  for await (const chunk of req) text += String(chunk);
  return text;
}

async function answer(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Saving the connection lists the server's models first, the way an Ollama-style server answers.
  if (req.method === 'GET' && req.url?.startsWith('/api/tags')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ models: [{ name: 'fake-model', size: 1 }] }));
    return;
  }
  if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
    res.writeHead(404).end();
    return;
  }
  const body = JSON.parse(await readBody(req)) as ChatBody;
  provider.requests.push(body);
  const reply = (provider.script.shift() ?? say('Nothing more.'))(body);
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  for (const chunk of reply.chunks) res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  res.end('data: [DONE]\n\n');
}

// ── The app ──────────────────────────────────────────────────────────────────

let nestApp: INestApplication;
let orm: MikroORM;
let fake: HttpServer;
let broadcasts: RealtimeSpies;

beforeAll(async () => {
  fake = createServer((req, res) => {
    answer(req, res).catch(() => res.destroy());
  });
  await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve));
  nestApp = await buildApp();
  orm = nestApp.get(MikroORM);
  broadcasts = spyOnRealtime(nestApp);
  await setAddonEnabled(orm, 'ai_assistant', true);
  const adminId = (await makeUser(orm, { role: 'admin' })).user.id;
  const { port } = fake.address() as AddressInfo;
  const res = await request(nestApp.getHttpServer())
    .put('/api/admin/ai/connection')
    .set('Cookie', sessionCookie(adminId))
    .send({ kind: 'custom', baseUrl: `http://127.0.0.1:${port}/v1`, model: 'fake-model' });
  expect(res.status).toBe(200);
});

beforeEach(async () => {
  await resetRateLimits(nestApp);
  provider.requests = [];
  provider.script = [];
  broadcasts.broadcast.mockClear();
});

afterAll(async () => {
  vi.restoreAllMocks();
  await nestApp.close();
  await new Promise<void>((resolve) => fake.close(() => resolve()));
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const CTX = { locale: 'en', timeZone: 'Europe/Berlin' };

interface Answer {
  status: number;
  chunks: UiStreamChunk[];
  json: Record<string, unknown> | null;
}

function asText(req: request.Test): request.Test {
  return req.buffer(true).parse((res, done) => {
    let text = '';
    res.setEncoding('utf8');
    res.on('data', (chunk: string) => (text += chunk));
    res.on('end', () => done(null, text));
  });
}

function parseAnswer(status: number, contentType: string, text: string): Answer {
  if (!contentType.includes('text/event-stream')) {
    return { status, chunks: [], json: text ? (JSON.parse(text) as Record<string, unknown>) : null };
  }
  const events = text
    .split('\n\n')
    .filter((event) => event.startsWith('data: '))
    .map((event) => event.slice('data: '.length));
  expect(events.at(-1)).toBe('[DONE]');
  return { status, chunks: events.slice(0, -1).map((event) => JSON.parse(event) as UiStreamChunk), json: null };
}

async function post(path: string, userId: number, body: object): Promise<Answer> {
  const res = await asText(request(nestApp.getHttpServer()).post(path).set('Cookie', sessionCookie(userId)).send(body));
  return parseAnswer(res.status, String(res.headers['content-type']), res.body as string);
}

/** The booking file as the client uploads it: multipart, the context as text fields. */
const BOOKING_TEXT = 'Your stay at Casa Lisboa\nCheck-in 2026-06-11\nConfirmation HM4X2';

interface UploadOpts {
  name?: string;
  threadId?: number;
  locale?: string;
}

async function upload(path: string, userId: number, opts: UploadOpts = {}): Promise<Answer> {
  const name = opts.name ?? 'AirBnB Buchung.txt';
  let req = request(nestApp.getHttpServer())
    .post(path)
    .set('Cookie', sessionCookie(userId))
    .field('locale', opts.locale ?? CTX.locale)
    .field('timeZone', CTX.timeZone);
  if (opts.threadId !== undefined) req = req.field('threadId', String(opts.threadId));
  req = req.attach('file', Buffer.from(BOOKING_TEXT), { filename: name, contentType: 'text/plain' });
  const res = await asText(req);
  return parseAnswer(res.status, String(res.headers['content-type']), res.body as string);
}

function get(path: string, userId: number) {
  return request(nestApp.getHttpServer()).get(path).set('Cookie', sessionCookie(userId));
}

const ofType = <T extends UiStreamChunk['type']>(chunks: UiStreamChunk[], type: T) =>
  chunks.filter((chunk): chunk is Extract<UiStreamChunk, { type: T }> => chunk.type === type);

async function travelerWithTrip() {
  const { user } = await makeUser(orm);
  const trip = await makeTrip(orm, user.id, { title: 'Lisbon', start_date: '2026-06-11', end_date: '2026-06-14' });
  return { userId: user.id, tripId: trip.id, base: `/api/trips/${trip.id}/assistant` };
}

/** The booking import with its extractor on, the AI off, answering `preview`. */
function stubImport(preview: BookingImportPreviewResponse) {
  const bookingImport = nestApp.get(BookingImportService);
  const spies = [
    vi.spyOn(bookingImport, 'isAvailable').mockReturnValue(true),
    vi.spyOn(bookingImport, 'aiAvailable').mockResolvedValue(false),
    vi.spyOn(bookingImport, 'preview').mockResolvedValue(preview),
  ];
  return () => spies.forEach((spy) => spy.mockRestore());
}

const NO_BOOKING: BookingImportPreviewResponse = {
  items: [],
  warnings: ['AirBnB Buchung.txt: no reservations found'],
};

const ONE_BOOKING: BookingImportPreviewResponse = {
  items: [{ type: 'hotel', title: 'Casa Lisboa', source: { fileName: 'AirBnB Buchung.txt', index: 0 } }],
  warnings: [],
};

/** The attachment the thread's first message names, and its row. */
async function keptAttachment(t: { userId: number; base: string }, threadId: number) {
  const shown = await get(`${t.base}/threads/${threadId}`, t.userId);
  const part = (shown.body.messages[0].parts as Array<{ type: string; attachmentId?: string }>)[0];
  const row = await findRow(orm, AssistantAttachments, { id: part.attachmentId ?? '' });
  return { part, row };
}

// ── Cases ────────────────────────────────────────────────────────────────────

describe('Trip assistant: attached files', () => {
  it('ATTE2E-001: an attached file is kept with its conversation under the id its message names, and goes with it', async () => {
    const t = await travelerWithTrip();
    const restore = stubImport(ONE_BOOKING);
    let threadId: number;
    try {
      const turn = await upload(`${t.base}/attachments`, t.userId);
      expect(turn.status).toBe(200);
      threadId = ofType(turn.chunks, 'data-trek-thread')[0].data.threadId;
    } finally {
      restore();
    }
    const { part, row } = await keptAttachment(t, threadId);
    expect(part).toMatchObject({ type: 'attachment', name: 'AirBnB Buchung.txt', mime: 'text/plain' });
    expect(row).toMatchObject({
      thread_id: threadId,
      user_id: t.userId,
      trip_id: t.tripId,
      name: 'AirBnB Buchung.txt',
      text: BOOKING_TEXT,
      text_status: 'ok',
      shared_at: null,
      file_id: null,
    });
    const storage = nestApp.get(StorageService);
    const key = String(row?.storage_key);
    expect(key.startsWith('assistant/')).toBe(true);
    expect(await storage.exists('files', key)).toBe(true);
    // The text never rides along in the thread.
    const shown = await get(`${t.base}/threads/${threadId}`, t.userId);
    expect(JSON.stringify(shown.body)).not.toContain('HM4X2');

    const other = await makeUser(orm);
    expect((await get(`${t.base}/threads/${threadId}`, other.user.id)).status).toBe(404);

    const removed = await request(nestApp.getHttpServer())
      .delete(`${t.base}/threads/${threadId}`)
      .set('Cookie', sessionCookie(t.userId));
    expect(removed.status).toBe(200);
    expect(await countRows(orm, AssistantAttachments, { thread: threadId })).toBe(0);
    expect(await storage.exists('files', key)).toBe(false);
  });

  it('ATTE2E-002: a storage that refuses the bytes refuses the turn before anything is written', async () => {
    const t = await travelerWithTrip();
    const restore = stubImport(ONE_BOOKING);
    const put = vi.spyOn(nestApp.get(StorageService), 'put').mockRejectedValue(new Error('bucket is gone'));
    try {
      const turn = await upload(`${t.base}/attachments`, t.userId);
      expect(turn.status).toBe(500);
      expect(turn.chunks).toEqual([]);
    } finally {
      put.mockRestore();
      restore();
    }
    expect(await countRows(orm, AssistantThreads, { trip: t.tripId })).toBe(0);
    expect(await countRows(orm, AssistantAttachments, { trip: t.tripId })).toBe(0);
  });

  it('ATTE2E-003: a file without a booking is answered with why and what to do next, never with an error', async () => {
    const t = await travelerWithTrip();
    const restore = stubImport(NO_BOOKING);
    let turn: Answer;
    try {
      turn = await upload(`${t.base}/attachments`, t.userId);
    } finally {
      restore();
    }
    expect(turn.status).toBe(200);
    expect(ofType(turn.chunks, 'error')).toEqual([]);
    expect(ofType(turn.chunks, 'finish')[0]).toMatchObject({ finishReason: 'stop' });
    expect(ofType(turn.chunks, 'tool-output-available')[0].output).toEqual({
      bookings: [],
      reason: 'ai_not_configured',
    });
    const line = ofType(turn.chunks, 'text-delta')
      .map((chunk) => chunk.delta)
      .join('');
    expect(line).toBe(
      'I could not find a booking in AirBnB Buchung.txt. AI reading is not set up for imports here, so only ' +
        'TREK’s own reader looked at it. What should I do with the file?',
    );
    expect(ofType(turn.chunks, 'data-trek-follow-ups')[0].data.questions).toEqual([
      'Keep it in Files',
      'Create a booking from it',
      'What is in the file?',
    ]);
    const threadId = ofType(turn.chunks, 'data-trek-thread')[0].data.threadId;
    const shown = await get(`${t.base}/threads/${threadId}`, t.userId);
    expect(shown.body.messages[1].status).toBe('complete');
    expect(shown.body.messages[1].parts.map((part: { type: string }) => part.type)).toEqual([
      'tool-call',
      'text',
      'data-trek-follow-ups',
    ]);

    provider.script = [say('Shall I keep it?')];
    await post(`${t.base}/chat`, t.userId, { ...CTX, threadId, text: 'Keep it in Files' });
    const sent = provider.requests[0].messages.map((message) => String(message.content ?? '')).join(' ');
    expect(sent).toContain('found no booking in it: AI reading for imports is not set up on this server');
  });

  it('ATTE2E-004: the answer is written in the language of the request', async () => {
    const t = await travelerWithTrip();
    const restore = stubImport(NO_BOOKING);
    try {
      const turn = await upload(`${t.base}/attachments`, t.userId, { locale: 'de' });
      const line = ofType(turn.chunks, 'text-delta')
        .map((chunk) => chunk.delta)
        .join('');
      expect(line).toContain('Ich habe in AirBnB Buchung.txt keine Buchung gefunden.');
      expect(line).toContain('Was soll ich mit der Datei machen?');
      expect(ofType(turn.chunks, 'data-trek-follow-ups')[0].data.questions[0]).toBe('In Dateien ablegen');
    } finally {
      restore();
    }
  });

  /** A thread holding the booking file without a booking, and the id the file is kept under. */
  async function threadWithFile(t: { userId: number; base: string }) {
    const restore = stubImport(NO_BOOKING);
    try {
      const turn = await upload(`${t.base}/attachments`, t.userId);
      const threadId = ofType(turn.chunks, 'data-trek-thread')[0].data.threadId;
      const { part } = await keptAttachment(t, threadId);
      return { threadId, attachmentId: String(part.attachmentId) };
    } finally {
      restore();
    }
  }

  it('ATTE2E-005: the model reads the file only after the user agreed, and proposes the booking from it', async () => {
    const t = await travelerWithTrip();
    const { threadId, attachmentId } = await threadWithFile(t);

    provider.script = [callTools({ id: 'call_read', name: 'read_attached_file', args: { attachmentId } })];
    const asked = await post(`${t.base}/chat`, t.userId, { ...CTX, threadId, text: 'Create a booking from it' });
    const offered = provider.requests[0];
    expect(offered.tools?.map((tool) => tool.function.name)).toContain('read_attached_file');
    const sentFirst = offered.messages.map((message) => String(message.content ?? '')).join(' ');
    expect(sentFirst).toContain(`attachment id ${attachmentId}`);
    expect(sentFirst).not.toContain('HM4X2');
    const [card] = ofType(asked.chunks, 'data-trek-change');
    expect(card.data).toMatchObject({
      verbKey: 'readAttachment',
      subject: 'AirBnB Buchung.txt',
      rows: [{ labelKey: 'sentTo', after: expect.stringContaining('fake-model') }],
      undoable: false,
    });
    const toolCallId = ofType(asked.chunks, 'tool-approval-request')[0].toolCallId;

    provider.script = [
      callTools({
        id: 'call_book',
        name: 'create_reservation',
        args: { title: 'Casa Lisboa', type: 'hotel', confirmation_number: 'HM4X2' },
      }),
    ];
    const decided = await post(`${t.base}/threads/${threadId}/decisions`, t.userId, {
      ...CTX,
      decisions: [{ toolCallId, approved: true }],
    });
    expect(decided.status).toBe(200);
    const sentAfter = provider.requests[1].messages.map((message) => String(message.content ?? '')).join(' ');
    expect(sentAfter).toContain('The user let you read the attached file "AirBnB Buchung.txt"');
    expect(sentAfter).toContain('Confirmation HM4X2');
    const booking = ofType(decided.chunks, 'tool-input-start').find((chunk) => chunk.toolName === 'create_reservation');
    expect(booking).toBeDefined();
    expect(ofType(decided.chunks, 'tool-approval-request').map((chunk) => chunk.toolCallId)).toContain(
      booking?.toolCallId,
    );
    expect((await findRow(orm, AssistantAttachments, { id: attachmentId }))?.shared_at).not.toBeNull();

    // The text stays on the server: not in the stream of the read, not in the thread, not in a stored part.
    const readOutput = ofType(decided.chunks, 'tool-output-available').find((chunk) => chunk.toolCallId === toolCallId);
    expect(JSON.stringify(readOutput)).not.toContain('HM4X2');
    const shown = await get(`${t.base}/threads/${threadId}`, t.userId);
    expect(JSON.stringify(shown.body)).not.toContain('Check-in 2026-06-11');
    const stored = await findRows(orm, AssistantMessages, { thread: threadId });
    expect(stored.map((row) => row.parts).join(' ')).not.toContain('Check-in 2026-06-11');
  });

  it('ATTE2E-006: once agreed, a later read of the same file runs at once', async () => {
    const t = await travelerWithTrip();
    const { threadId, attachmentId } = await threadWithFile(t);
    provider.script = [callTools({ id: 'call_read', name: 'read_attached_file', args: { attachmentId } })];
    const asked = await post(`${t.base}/chat`, t.userId, { ...CTX, threadId, text: 'What is in the file?' });
    const toolCallId = ofType(asked.chunks, 'tool-approval-request')[0].toolCallId;
    provider.script = [say('A stay at Casa Lisboa.')];
    await post(`${t.base}/threads/${threadId}/decisions`, t.userId, {
      ...CTX,
      decisions: [{ toolCallId, approved: true }],
    });

    provider.requests = [];
    provider.script = [
      callTools({ id: 'call_again', name: 'read_attached_file', args: { attachmentId } }),
      say('The confirmation is HM4X2.'),
    ];
    const again = await post(`${t.base}/chat`, t.userId, { ...CTX, threadId, text: 'And the confirmation?' });
    expect(ofType(again.chunks, 'tool-approval-request')).toEqual([]);
    const answer = provider.requests[1].messages.find((message) => message.tool_call_id === 'call_again');
    expect(String(answer?.content)).toContain('Confirmation HM4X2');
    const streamed = ofType(again.chunks, 'tool-output-available').find((chunk) => chunk.toolCallId === 'call_again');
    expect(streamed?.output).toEqual({ name: 'AirBnB Buchung.txt', mime: 'text/plain', read: true });
  });

  it('ATTE2E-007: a file of another conversation or another user reads like one that does not exist', async () => {
    const owner = await travelerWithTrip();
    const { attachmentId } = await threadWithFile(owner);
    const other = await travelerWithTrip();
    const own = await threadWithFile(other);
    const sameTripThread = await threadWithFile(owner);
    const refusalOf = async (t: { userId: number; base: string }, threadId: number, id: string) => {
      provider.script = [callTools({ id: `call_${id}`, name: 'read_attached_file', args: { attachmentId: id } })];
      const turn = await post(`${t.base}/chat`, t.userId, { ...CTX, threadId, text: 'Read it' });
      expect(ofType(turn.chunks, 'tool-approval-request')).toEqual([]);
      return ofType(turn.chunks, 'tool-output-error')[0]?.errorText;
    };
    const message = 'No such attachment in this conversation.';
    expect(await refusalOf(other, own.threadId, attachmentId)).toBe(message);
    expect(await refusalOf(owner, sameTripThread.threadId, attachmentId)).toBe(message);
    expect(await refusalOf(owner, sameTripThread.threadId, '9f1e2d3c-4b5a-4968-8776-655443322110')).toBe(message);
    expect((await findRow(orm, AssistantAttachments, { id: attachmentId }))?.shared_at).toBeNull();
  });

  /** A chat turn in which the model proposes keeping the file, and the id the change is held under. */
  // Every proposal gets a call id of its own: a second keep in one thread is a new call, not the first one again.
  let keeps = 0;
  async function proposeKeep(t: { userId: number; base: string }, threadId: number, args: Record<string, unknown>) {
    keeps += 1;
    provider.script = [callTools({ id: `call_keep_${threadId}_${keeps}`, name: 'keep_attached_file', args })];
    const turn = await post(`${t.base}/chat`, t.userId, { ...CTX, threadId, text: 'Keep it with the booking' });
    return { turn, toolCallId: ofType(turn.chunks, 'tool-approval-request')[0]?.toolCallId };
  }

  it('ATTE2E-008: the file is kept in Files with its booking once the user applies it, and only once', async () => {
    const t = await travelerWithTrip();
    const booking = await makeReservation(orm, t.tripId, { title: 'Casa Lisboa', type: 'hotel' });
    const { threadId, attachmentId } = await threadWithFile(t);
    const { turn, toolCallId } = await proposeKeep(t, threadId, { attachmentId, reservation_id: booking.id });
    expect(provider.requests[0].tools?.map((tool) => tool.function.name)).toContain('keep_attached_file');
    expect(ofType(turn.chunks, 'data-trek-change')[0].data).toMatchObject({
      verbKey: 'keepFile',
      subject: 'AirBnB Buchung.txt',
      rows: [{ labelKey: 'attachedTo', after: 'Casa Lisboa' }],
    });

    provider.script = [say('It is in Files now.')];
    const decided = await post(`${t.base}/threads/${threadId}/decisions`, t.userId, {
      ...CTX,
      decisions: [{ toolCallId, approved: true }],
    });
    expect(ofType(decided.chunks, 'data-trek-applied')[0].data).toMatchObject({ toolCallId, entity: 'file' });
    const listed = await get(`/api/trips/${t.tripId}/files`, t.userId);
    expect(listed.status).toBe(200);
    expect(listed.body.files).toHaveLength(1);
    const [file] = listed.body.files as Array<{ id: number; original_name: string; reservation_id: number | null }>;
    expect(file).toMatchObject({ original_name: 'AirBnB Buchung.txt', reservation_id: booking.id });
    expect((await findRow(orm, AssistantAttachments, { id: attachmentId }))?.file_id).toBe(file.id);
    expect(broadcasts.broadcast).toHaveBeenCalledWith(
      String(t.tripId),
      'file:created',
      { file: expect.objectContaining({ id: file.id }) },
      undefined,
    );
    const sent = provider.requests[1].messages.map((message) => String(message.content ?? '')).join(' ');
    expect(sent).toContain(`The attached file "AirBnB Buchung.txt" is in the trip's Files now (file id ${file.id}).`);
    const download = await get(`/api/trips/${t.tripId}/files/${file.id}/download`, t.userId);
    expect(download.status).toBe(200);

    // A second keep of the same file answers the first one.
    const second = await proposeKeep(t, threadId, { attachmentId });
    provider.script = [say('Already there.')];
    await post(`${t.base}/threads/${threadId}/decisions`, t.userId, {
      ...CTX,
      decisions: [{ toolCallId: second.toolCallId, approved: true }],
    });
    expect((await get(`/api/trips/${t.tripId}/files`, t.userId)).body.files).toHaveLength(1);
  });

  it('ATTE2E-009: a demo account and a member without the right to upload keep nothing', async () => {
    const t = await travelerWithTrip();
    const { threadId, attachmentId } = await threadWithFile(t);
    // The right goes after the proposal, so it is the apply that refuses, not the offer.
    const tryKeep = async (arm: () => void) => {
      const { toolCallId } = await proposeKeep(t, threadId, { attachmentId });
      arm();
      provider.script = [say('Could not keep it.')];
      const decided = await post(`${t.base}/threads/${threadId}/decisions`, t.userId, {
        ...CTX,
        decisions: [{ toolCallId, approved: true }],
      });
      return ofType(decided.chunks, 'tool-output-error')[0]?.errorText;
    };
    const demo = vi.spyOn(nestApp.get(DemoService), 'isDemoUserId');
    try {
      expect(await tryKeep(() => demo.mockResolvedValue(true))).toBe('You are not allowed to keep files on this trip.');
    } finally {
      demo.mockRestore();
    }
    const permissions = vi.spyOn(nestApp.get(PermissionsService), 'checkPermission');
    try {
      const noUpload = () =>
        permissions.mockImplementation((action: string) => Promise.resolve(action !== 'file_upload'));
      expect(await tryKeep(noUpload)).toBe('You are not allowed to keep files on this trip.');
    } finally {
      permissions.mockRestore();
    }
    expect((await get(`/api/trips/${t.tripId}/files`, t.userId)).body.files).toHaveLength(0);
    expect(broadcasts.broadcast).not.toHaveBeenCalledWith(
      String(t.tripId),
      'file:created',
      expect.anything(),
      undefined,
    );
  });
});
