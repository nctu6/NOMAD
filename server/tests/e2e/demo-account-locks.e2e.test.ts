/**
 * Demo account locks e2e: on a demo instance the shared demo account cannot
 * mint API keys or MCP tokens, change its name, address or picture, or touch
 * passkeys, and its language stays English. Every visitor signs in as that one
 * account, so each of these would be one stranger's change to everybody's demo.
 *
 * Boots AuthModule (with the passkey routes) and SettingsModule with the real
 * JwtAuthGuard, the Zod pipe and the exception filter over a migrated temp
 * SQLite db. The other accounts on the same instance, and the demo address on
 * an instance that is not a demo, keep every one of these routes.
 */
import { Settings } from '../../src/db/entities/Settings.entity';
import { AppConfigModule } from '../../src/nest/app-config/app-config.module';
import { AuthModule } from '../../src/nest/auth/auth.module';
import { DEMO_ACCOUNT_REFUSAL } from '../../src/nest/common/demo-write';
import { DemoModule } from '../../src/nest/common/demo.module';
import { TrekExceptionFilter } from '../../src/nest/common/trek-exception.filter';
import { ZodValidationPipe } from '../../src/nest/common/zod-validation.pipe';
import { MailerService } from '../../src/nest/notifications/mailer/mailer.service';
import { RealtimeModule } from '../../src/nest/realtime/realtime.module';
import { RealtimeService } from '../../src/nest/realtime/realtime.service';
import { SettingsModule } from '../../src/nest/settings/settings.module';
import { createSnapshotTestDb } from '../helpers/db-mock';
import { deleteRows, findRow, insertRow } from '../helpers/factories/rows';
import { makeUser } from '../helpers/factories/users';
import { FakeRealtimeService } from '../helpers/fake-realtime';
import { resetRateLimits } from '../helpers/test-db';
import { createTestMikroOrmModule, createTestOrm, type TestOrm } from '../helpers/test-orm';
import { TestUnitOfWorkModule } from '../helpers/test-uow';
import { sessionCookie } from './harness';
import { Test } from '@nestjs/testing';

import cookieParser from 'cookie-parser';
import type { Server } from 'http';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/nest/audit/audit-log.logger', () => ({
  LOG_LEVEL: 'error',
  logInfo: vi.fn(),
  logDebug: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

const db = createSnapshotTestDb();
const DEMO = 1;
const VISITOR_ADMIN = 2;

let orm: TestOrm;
let server: Server;
let app: Awaited<ReturnType<typeof build>>;

async function build() {
  const moduleRef = await Test.createTestingModule({
    imports: [
      await TestUnitOfWorkModule.forRoot(db),
      await createTestMikroOrmModule(db),
      AppConfigModule,
      RealtimeModule,
      DemoModule,
      AuthModule,
      SettingsModule,
    ],
  })
    .overrideProvider(RealtimeService)
    .useValue(new FakeRealtimeService())
    .overrideProvider(MailerService)
    .useValue({ sendPasswordResetEmail: vi.fn() })
    .compile();
  const nest = moduleRef.createNestApplication();
  nest.use(cookieParser());
  nest.useGlobalPipes(new ZodValidationPipe());
  nest.useGlobalFilters(new TrekExceptionFilter());
  await nest.init();
  return nest;
}

const as = (userId: number) => ({ Cookie: sessionCookie(userId) });

async function languageOf(userId: number): Promise<string | undefined> {
  return (await findRow(orm, Settings, { user: userId, key: 'language' }))?.value;
}

beforeAll(async () => {
  orm = await createTestOrm(db);
  await makeUser(orm, { id: DEMO, username: 'demo', email: 'demo@trek.app' });
  await makeUser(orm, { id: VISITOR_ADMIN, username: 'admin', email: 'admin@example.test', role: 'admin' });
  app = await build();
  server = app.getHttpServer();
});

beforeEach(async () => {
  vi.stubEnv('DEMO_MODE', 'true');
  await resetRateLimits(app);
  await deleteRows(orm, Settings);
  await insertRow(orm, Settings, { user: DEMO, key: 'language', value: 'en' });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await app.close();
  await orm.close();
});

describe('Demo account locks e2e', () => {
  it('DEMOLOCK-001: the demo account cannot create an API key', async () => {
    const res = await request(server).post('/api/auth/api-tokens').set(as(DEMO)).send({ name: 'Mine' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: DEMO_ACCOUNT_REFUSAL.apiKeys });
  });

  it('DEMOLOCK-002: the demo account can neither create nor delete an MCP token', async () => {
    const created = await request(server).post('/api/auth/mcp-tokens').set(as(DEMO)).send({ name: 'Claude' });
    expect(created.status).toBe(403);
    expect(created.body).toEqual({ error: DEMO_ACCOUNT_REFUSAL.mcp });

    const removed = await request(server).delete('/api/auth/mcp-tokens/1').set(as(DEMO));
    expect(removed.status).toBe(403);
    expect(removed.body).toEqual({ error: DEMO_ACCOUNT_REFUSAL.mcp });
  });

  it('DEMOLOCK-003: the name, the address and the picture of the demo account stay as seeded', async () => {
    const name = await request(server).put('/api/auth/me/settings').set(as(DEMO)).send({ username: 'renamed' });
    expect(name.status).toBe(403);
    expect(name.body).toEqual({ error: DEMO_ACCOUNT_REFUSAL.account });

    const address = await request(server)
      .put('/api/auth/me/settings')
      .set(as(DEMO))
      .send({ email: 'mine@example.test' });
    expect(address.status).toBe(403);

    const avatar = await request(server).delete('/api/auth/avatar').set(as(DEMO));
    expect(avatar.status).toBe(403);
    expect(avatar.body).toEqual({ error: DEMO_ACCOUNT_REFUSAL.account });
  });

  it('DEMOLOCK-004: passkeys of the demo account can be neither renamed nor deleted', async () => {
    const renamed = await request(server)
      .patch('/api/auth/passkey/credentials/abc')
      .set(as(DEMO))
      .send({ name: 'Laptop' });
    expect(renamed.status).toBe(403);
    expect(renamed.body).toEqual({ error: DEMO_ACCOUNT_REFUSAL.passkeys });

    const deleted = await request(server)
      .delete('/api/auth/passkey/credentials/abc')
      .set(as(DEMO))
      .send({ password: 'demo12345' });
    expect(deleted.status).toBe(403);
    expect(deleted.body).toEqual({ error: DEMO_ACCOUNT_REFUSAL.passkeys });
  });

  it('DEMOLOCK-005: a language picked on the demo account is answered as unchanged and not stored', async () => {
    const one = await request(server).put('/api/settings').set(as(DEMO)).send({ key: 'language', value: 'de' });
    expect(one.status).toBe(200);
    expect(one.body).toEqual({ success: true, key: 'language', unchanged: true });
    expect(await languageOf(DEMO)).toBe('en');
  });

  it('DEMOLOCK-006: a bulk save of the demo account keeps every other key and drops the language', async () => {
    const res = await request(server)
      .post('/api/settings/bulk')
      .set(as(DEMO))
      .send({ settings: { language: 'fr', temperature_unit: 'fahrenheit' } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, updated: 1 });
    expect(await languageOf(DEMO)).toBe('en');

    const settings = await request(server).get('/api/settings').set(as(DEMO));
    expect(settings.body.settings).toEqual(expect.objectContaining({ language: 'en', temperature_unit: 'fahrenheit' }));
  });

  it('DEMOLOCK-007: the admin of a demo instance keeps every one of these routes', async () => {
    const token = await request(server).post('/api/auth/api-tokens').set(as(VISITOR_ADMIN)).send({ name: 'Admin' });
    expect(token.status).toBe(201);

    const language = await request(server)
      .put('/api/settings')
      .set(as(VISITOR_ADMIN))
      .send({ key: 'language', value: 'de' });
    expect(language.status).toBe(200);
    expect(await languageOf(VISITOR_ADMIN)).toBe('de');
  });

  it('DEMOLOCK-008: off a demo instance the demo address is an account like any other', async () => {
    vi.stubEnv('DEMO_MODE', 'false');
    const token = await request(server).post('/api/auth/api-tokens').set(as(DEMO)).send({ name: 'Mine' });
    expect(token.status).toBe(201);

    await request(server).put('/api/settings').set(as(DEMO)).send({ key: 'language', value: 'de' });
    expect(await languageOf(DEMO)).toBe('de');
  });
});
