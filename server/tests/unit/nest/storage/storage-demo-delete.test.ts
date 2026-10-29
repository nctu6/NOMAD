/**
 * A demo instance keeps the uploads its baseline points at.
 *
 * The hourly demo reset (src/demo/demo-reset.ts) puts the database back to
 * travel-baseline.db and leaves storage alone, so a file a visitor deleted in
 * between stays gone while the restored rows still name it. StorageService
 * .delete is the one place that stops it: with DEMO_MODE on it leaves the
 * content categories alone, and the caches, the backups and the assistant's
 * attachments are still deleted.
 *
 * The subject comes out of a Nest testing module with the real
 * RuntimeEnvService, so DEMO_MODE is read the way the server reads it. The
 * registry is a stub over a real LocalDriver, as in storage.service.test.ts,
 * with every category under a prefix of its own name.
 */
import { RuntimeEnvService } from '../../../../src/nest/app-config/runtime-env.service';
import { LocalDriver } from '../../../../src/nest/storage/drivers/local.driver';
import { StorageRegistryService, type ResolvedCategory } from '../../../../src/nest/storage/storage-registry.service';
import { StorageService } from '../../../../src/nest/storage/storage.service';
import {
  SERVED_CATEGORIES,
  StorageInvalidKeyError,
  type ServedCategory,
} from '../../../../src/nest/storage/storage.types';
import type { Provider } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';

/** The categories holding content that rows point at: a demo keeps their objects. */
const KEPT: ServedCategory[] = ['files', 'journey', 'covers', 'avatars', 'places', 'photos'];
/** The caches and the backups: a demo deletes them like any other instance. */
const DELETED: ServedCategory[] = ['photos-google', 'photos-trek', 'backups'];

const prevDemo = process.env.DEMO_MODE;
const roots: string[] = [];

afterEach(() => {
  if (prevDemo === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = prevDemo;
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

interface Fixture {
  storage: StorageService;
  /** Writes an object through the facade and answers where it sits on disk. */
  put(category: ServedCategory, name: string, body?: string): Promise<string>;
}

/** The facade out of a testing module; `runtimeEnv` replaces the real RuntimeEnvService when given. */
async function build(runtimeEnv?: Pick<RuntimeEnvService, 'isDemoMode'>): Promise<Fixture> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trek-demo-delete-'));
  roots.push(root);
  const driver = new LocalDriver({ id: 'demo-local', root });
  driver.init({ cleanSpool: true });
  const registry = {
    resolve: (category: ServedCategory): ResolvedCategory => ({
      driver,
      keyPrefix: `${category}/`,
      backendName: 'demo-local',
    }),
  };
  const env: Provider = runtimeEnv ? { provide: RuntimeEnvService, useValue: runtimeEnv } : RuntimeEnvService;
  const moduleRef = await Test.createTestingModule({
    providers: [StorageService, { provide: StorageRegistryService, useValue: registry }, env],
  }).compile();
  const storage = moduleRef.get(StorageService);
  return {
    storage,
    put: async (category, name, body = 'bytes') => {
      await storage.put(category, name, Readable.from([Buffer.from(body)]));
      return path.join(root, category, name);
    },
  };
}

describe('StorageService.delete on a demo instance', () => {
  it('STORAGE-DEMO-001: names every served category exactly once', () => {
    expect([...KEPT, ...DELETED].sort()).toEqual([...SERVED_CATEGORIES].sort());
  });

  it.each(KEPT)('STORAGE-DEMO-002: keeps the %s object and resolves as if it were gone', async (category) => {
    process.env.DEMO_MODE = 'true';
    const fx = await build();
    const onDisk = await fx.put(category, 'baseline.jpg');

    await expect(fx.storage.delete(category, 'baseline.jpg')).resolves.toBeUndefined();

    expect(fs.existsSync(onDisk)).toBe(true);
    expect(await fx.storage.exists(category, 'baseline.jpg')).toBe(true);
  });

  it.each(DELETED)('STORAGE-DEMO-003: still deletes the %s object', async (category) => {
    process.env.DEMO_MODE = 'true';
    const fx = await build();
    const onDisk = await fx.put(category, 'cached.jpg');

    await fx.storage.delete(category, 'cached.jpg');

    expect(fs.existsSync(onDisk)).toBe(false);
  });

  it.each([...SERVED_CATEGORIES])('STORAGE-DEMO-004: outside demo mode deletes the %s object', async (category) => {
    delete process.env.DEMO_MODE;
    const fx = await build();
    const onDisk = await fx.put(category, 'any.jpg');

    await fx.storage.delete(category, 'any.jpg');

    expect(fs.existsSync(onDisk)).toBe(false);
  });

  it('STORAGE-DEMO-005: a put after a kept delete still replaces the object under the same name', async () => {
    process.env.DEMO_MODE = 'true';
    const fx = await build();
    const onDisk = await fx.put('covers', 'cover.jpg', 'old');

    await fx.storage.delete('covers', 'cover.jpg');
    await fx.put('covers', 'cover.jpg', 'new');

    expect(fs.readFileSync(onDisk, 'utf8')).toBe('new');
  });

  it('STORAGE-DEMO-006: refuses a hostile name in demo mode as it does outside it', async () => {
    process.env.DEMO_MODE = 'true';
    const fx = await build();

    await expect(fx.storage.delete('covers', '../escape.jpg')).rejects.toBeInstanceOf(StorageInvalidKeyError);
  });

  it('STORAGE-DEMO-007: reads DEMO_MODE on every call, so a toggle takes effect without a restart', async () => {
    const fx = await build();
    const first = await fx.put('journey', 'first.jpg');
    const second = await fx.put('journey', 'second.jpg');

    process.env.DEMO_MODE = 'true';
    await fx.storage.delete('journey', 'first.jpg');
    delete process.env.DEMO_MODE;
    await fx.storage.delete('journey', 'second.jpg');

    expect(fs.existsSync(first)).toBe(true);
    expect(fs.existsSync(second)).toBe(false);
  });

  it('STORAGE-DEMO-008: asks the RuntimeEnvService the container hands it', async () => {
    delete process.env.DEMO_MODE;
    const fx = await build({ isDemoMode: () => true });
    const onDisk = await fx.put('avatars', 'face.jpg');

    await fx.storage.delete('avatars', 'face.jpg');

    expect(fs.existsSync(onDisk)).toBe(true);
  });

  it('STORAGE-DEMO-009: still deletes the assistant attachments, which no baseline relies on', async () => {
    process.env.DEMO_MODE = 'true';
    const fx = await build();
    const attachment = await fx.put('files', 'assistant/a1.pdf');
    const tripFile = await fx.put('files', 'trip.pdf');

    expect(fx.storage.keepsOnDelete('files', 'assistant/a1.pdf')).toBe(false);
    expect(fx.storage.keepsOnDelete('files', 'trip.pdf')).toBe(true);
    await fx.storage.delete('files', 'assistant/a1.pdf');
    await fx.storage.delete('files', 'trip.pdf');

    expect(fs.existsSync(attachment)).toBe(false);
    expect(fs.existsSync(tripFile)).toBe(true);
  });

  it('STORAGE-DEMO-010: keepsOnDelete answers false for every category outside demo mode', async () => {
    delete process.env.DEMO_MODE;
    const fx = await build();

    expect(SERVED_CATEGORIES.filter((category) => fx.storage.keepsOnDelete(category, 'any.jpg'))).toEqual([]);
  });
});
