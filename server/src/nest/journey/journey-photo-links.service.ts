import { JourneyPhotos } from '../../db/entities/JourneyPhotos.entity';
import type { JourneyPhotosRepository } from '../../db/repositories/JourneyPhotos.repository';
import type { GalleryPhoto, JourneyPhoto } from '../../types';
import { badRequest, notFound } from '../common/domain-error';
import { UnitOfWork } from '../database/unit-of-work';
import { JourneyDomainService } from './journey-domain.service';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';
import type { JourneyPhotosMoveRequest, JourneyPhotosMoveResponse } from '@trek/shared';

/**
 * Which entries a journey's photos sit on, and what they are called: a
 * gallery photo linked to an entry or taken off it, photos moved from one
 * entry to another, a caption changed. Every change is told to everyone on
 * the journey after it is written (the link and the unlink told nobody, so
 * another tab, and the journey page after an assistant change, stayed as it
 * was). The REST routes and the MCP tools both go through here.
 */
@Injectable()
export class JourneyPhotoLinksService {
  constructor(
    private readonly journeys: JourneyDomainService,
    private readonly uow: UnitOfWork,
    @InjectRepository(JourneyPhotos) private readonly photosRepo: JourneyPhotosRepository,
  ) {}

  /** Links a gallery photo of the entry's journey to the entry; null when either is not the user's to change. */
  async link(entryId: number, journeyPhotoId: number, userId: number, sid?: string): Promise<JourneyPhoto | null> {
    const photo = await this.journeys.linkPhotoToEntry(entryId, journeyPhotoId, userId);
    if (photo) await this.announce([entryId], sid);
    return photo;
  }

  /** Takes a photo off the entry; it stays in the gallery. False when nothing was taken off. */
  async unlink(entryId: number, journeyPhotoId: number, userId: number, sid?: string): Promise<boolean> {
    const done = await this.journeys.unlinkPhotoFromEntry(entryId, journeyPhotoId, userId);
    if (done) await this.announce([entryId], sid);
    return done;
  }

  /**
   * Moves photos of one entry to another of the same journey, in one write:
   * each is linked to the target (a suggestion it lands on becomes an entry,
   * as on any add) and, unless kept, taken off the source. Every photo must
   * be one of the source entry's; an entry outside the journey, or one the
   * user may not change, reads as not found.
   */
  async move(
    fromEntryId: number,
    req: JourneyPhotosMoveRequest,
    userId: number,
    sid?: string,
  ): Promise<JourneyPhotosMoveResponse> {
    const journeyId = await this.journeys.journeyIdOfEntry(fromEntryId);
    const target = await this.journeys.journeyIdOfEntry(req.toEntryId);
    if (journeyId === null || target !== journeyId || !(await this.journeys.canEdit(journeyId, userId))) {
      throw notFound('Entry not found');
    }
    if (fromEntryId === req.toEntryId) throw badRequest('Photos cannot move to the entry they are on');
    const entries = (await this.journeys.listEntries(journeyId, userId)) ?? [];
    const onSource = new Set(
      (entries.find((entry) => entry.id === fromEntryId)?.photos ?? []).map((photo) => photo.id),
    );
    const ids = [...new Set(req.photoIds)];
    if (ids.some((id) => !onSource.has(id))) throw badRequest('Every photo must be one of this entry');
    const kept = req.keep_in_source === true;
    // One after another: each link takes the next place among the target's photos.
    await this.uow.transactional(() =>
      ids.reduce<Promise<void>>(async (previous, id) => {
        await previous;
        if (!(await this.journeys.linkPhotoToEntry(req.toEntryId, id, userId))) throw notFound('Entry not found');
        if (!kept) await this.journeys.unlinkPhotoFromEntry(fromEntryId, id, userId);
      }, Promise.resolve()),
    );
    await this.announce([fromEntryId, req.toEntryId], sid);
    return { moved: ids, fromEntryId, toEntryId: req.toEntryId, kept };
  }

  /**
   * A gallery photo's caption, with the one it replaces, read in the same
   * write; null when the photo is not the user's to change or not in the
   * journey the call is about.
   */
  async setCaption(
    journeyId: number,
    journeyPhotoId: number,
    caption: string | null,
    userId: number,
  ): Promise<{ photo: GalleryPhoto; previous: { caption: string | null } } | null> {
    const scope = await this.photosRepo.findScopeById(journeyPhotoId);
    if (!scope || scope.journey_id !== journeyId || !(await this.journeys.canEdit(journeyId, userId))) return null;
    const previous = await this.uow.transactional(async () => {
      const before = await this.photosRepo.galleryReadOne(journeyPhotoId);
      await this.photosRepo.updateCaption(journeyPhotoId, caption as string);
      return { caption: before?.caption ?? null };
    });
    await this.journeys.broadcastJourneyEvent(journeyId, 'journey:updated', {});
    const photo = await this.photosRepo.galleryReadOne(journeyPhotoId);
    return photo ? { photo, previous } : null;
  }

  /**
   * The REST route's change of a photo (its caption, its place among the
   * entry's photos), told to everyone on the journey once written, as the
   * MCP caption is. Null when the service refused it.
   */
  async updatePhoto(
    journeyPhotoId: number,
    userId: number,
    data: { caption?: string; sort_order?: number },
    sid?: string,
  ): Promise<JourneyPhoto | null> {
    const photo = await this.journeys.updatePhoto(journeyPhotoId, userId, data);
    const scope = photo ? await this.photosRepo.findScopeById(journeyPhotoId) : undefined;
    if (scope) await this.journeys.broadcastJourneyEvent(scope.journey_id, 'journey:updated', {}, sid);
    return photo;
  }

  /** Tells everyone on the journey that these entries' photos changed; the asking tab already knows. */
  private async announce(entryIds: number[], sid?: string): Promise<void> {
    const journeyId = await this.journeys.journeyIdOfEntry(entryIds[0]);
    if (journeyId === null) return;
    await Promise.all(
      [...new Set(entryIds)].map((entryId) =>
        this.journeys.broadcastJourneyEvent(journeyId, 'journey:entry:updated', { entryId }, sid),
      ),
    );
  }
}
