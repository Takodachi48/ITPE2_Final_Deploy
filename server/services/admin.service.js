import {
  AppError,
  conflict,
  forbidden,
  notFound,
  unprocessable,
} from '../lib/errors.js';
import { withTransaction } from '../db/pool.js';
import {
  addVideo,
  archiveModuleRow,
  countModulePresenters,
  deleteModuleRow,
  deletePresenter,
  deleteVideo,
  findPresenterIds,
  insertModule,
  insertPresenter,
  listPresenterPublishedModules,
  lockModule,
  nextModuleId,
  replacePresenters,
  replaceVideos,
  themeExists,
  updateModuleRow,
  updatePresenter,
  updateVideo,
} from '../repositories/admin.repository.js';
import { findModule } from '../repositories/content.repository.js';
import {
  countAdmins,
  findProfileById,
  updateProfile,
} from '../repositories/profiles.repository.js';
import { ensureUniqueSlug } from '../utils/slug.js';

const uniqueIds = (ids = []) => [...new Set(ids)];

const validateTheme = async (client, themeId) => {
  if (!(await themeExists(client, themeId))) {
    throw unprocessable(`The theme "${themeId}" does not exist.`, [
      { path: 'themeId', message: 'Choose an existing theme.' },
    ]);
  }
};

const validatePresenters = async (client, ids) => {
  const unique = uniqueIds(ids);

  if (!unique.length) return unique;

  const found = await findPresenterIds(client, unique);
  const foundSet = new Set(found);
  const missing = unique.filter((id) => !foundSet.has(id));

  if (missing.length) {
    throw unprocessable('One or more presenters do not exist.', [
      {
        path: 'presenterIds',
        message: `Unknown presenter ids: ${missing.join(', ')}`,
      },
    ]);
  }

  return unique;
};

const finalPresenterCount = async (client, moduleId, input, existing) => {
  if (input.presenterIds !== undefined) {
    return uniqueIds(input.presenterIds).length;
  }

  if (!existing) return 0;

  return countModulePresenters(client, moduleId);
};

const validatePublishState = (status, presenterCount) => {
  if (status === 'published' && presenterCount === 0) {
    throw unprocessable(
      'A published module needs at least one presenter.',
      [{ path: 'presenterIds', message: 'Add a presenter before publishing.' }],
    );
  }
};

export async function createModule(input) {
  const id = await withTransaction(async (client) => {
    const moduleId = input.id || (await nextModuleId(client));

    if (await lockModule(client, moduleId)) {
      throw conflict(`Module ${moduleId} already exists.`, [
        { path: 'id', message: 'Choose a different module id.' },
      ]);
    }

    await validateTheme(client, input.themeId);
    const presenterIds = await validatePresenters(
      client,
      input.presenterIds || [],
    );
    validatePublishState(input.status, presenterIds.length);

    const slug = await ensureUniqueSlug(
      client,
      input.slug || input.title,
      moduleId,
    );

    await insertModule(client, {
      id: moduleId,
      slug,
      title: input.title,
      description: input.description,
      summary: input.summary || '',
      pptUrl: input.pptUrl || null,
      status: input.status,
      themeId: input.themeId,
    });

    if (input.videos) await replaceVideos(client, moduleId, input.videos);
    if (presenterIds.length) {
      await replacePresenters(client, moduleId, presenterIds);
    }

    return moduleId;
  });

  return findModule(id, { includeDrafts: true });
}

export async function updateModule(id, input) {
  await withTransaction(async (client) => {
    const existing = await lockModule(client, id);

    if (!existing) throw notFound(`Module ${id} was not found.`);

    if (input.themeId !== undefined) {
      await validateTheme(client, input.themeId);
    }

    const presenterIds =
      input.presenterIds !== undefined
        ? await validatePresenters(client, input.presenterIds)
        : undefined;

    const finalStatus = input.status || existing.status;
    const finalPresenters = await finalPresenterCount(
      client,
      id,
      input,
      existing,
    );

    validatePublishState(finalStatus, finalPresenters);

    const updates = {};

    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.summary !== undefined) updates.summary = input.summary;
    if (input.pptUrl !== undefined) updates.pptUrl = input.pptUrl;
    if (input.themeId !== undefined) updates.themeId = input.themeId;
    if (presenterIds !== undefined) {
      await replacePresenters(client, id, presenterIds);
    }

    if (input.slug !== undefined) {
      updates.slug = await ensureUniqueSlug(client, input.slug, id);
    }

    if (input.status !== undefined) {
      updates.status = input.status;

      if (input.status === 'published' && existing.status !== 'published') {
        updates.publishedAt = new Date();
      }
    }

    if (Object.keys(updates).length) {
      await updateModuleRow(client, id, updates);
    }

    if (input.videos !== undefined) {
      await replaceVideos(client, id, input.videos);
    }
  });

  return findModule(id, { includeDrafts: true });
}

export async function removeModule(id, { hard = false, actor } = {}) {
  if (hard && actor?.profile?.role !== 'admin') {
    throw forbidden('Only admins can permanently delete a module.');
  }

  return withTransaction(async (client) => {
    const existing = await lockModule(client, id);
    if (!existing) throw notFound(`Module ${id} was not found.`);

    if (hard) {
      await deleteModuleRow(client, id);
      return { id, deleted: true };
    }

    const archived = await archiveModuleRow(client, id);
    return {
      id,
      deleted: false,
      status: archived.status,
    };
  });
}

export async function appendVideo(moduleId, input) {
  const module = await findModule(moduleId, { includeDrafts: true });
  if (!module) throw notFound(`Module ${moduleId} was not found.`);

  return addVideo(moduleId, input);
}

export async function editVideo(moduleId, videoId, input) {
  const existing = await findModule(moduleId, { includeDrafts: true });
  if (!existing) throw notFound(`Module ${moduleId} was not found.`);

  const video = await updateVideo(moduleId, videoId, input);
  if (!video) throw notFound('That video was not found on this module.');

  return video;
}

export async function removeVideo(moduleId, videoId) {
  const existing = await findModule(moduleId, { includeDrafts: true });
  if (!existing) throw notFound(`Module ${moduleId} was not found.`);

  const deleted = await deleteVideo(moduleId, videoId);
  if (!deleted) throw notFound('That video was not found on this module.');

  return deleted;
}

export async function setModulePresenters(id, presenterIds) {
  await withTransaction(async (client) => {
    const existing = await lockModule(client, id);
    if (!existing) throw notFound(`Module ${id} was not found.`);

    const unique = await validatePresenters(client, presenterIds);

    if (existing.status === 'published' && unique.length === 0) {
      throw unprocessable(
        'A published module needs at least one presenter.',
        [{ path: 'presenterIds', message: 'Choose at least one presenter.' }],
      );
    }

    await replacePresenters(client, id, unique);
  });

  return findModule(id, { includeDrafts: true });
}

export async function addPresenter(name) {
  return insertPresenter(name);
}

export async function renamePresenter(id, name) {
  const presenter = await updatePresenter(id, name);

  if (!presenter) throw notFound('That presenter was not found.');
  return presenter;
}

export async function removePresenter(id) {
  const publishedModules = await listPresenterPublishedModules(id);

  if (publishedModules.length) {
    throw conflict(
      'This presenter is attached to published modules. Remove them from those modules first.',
      { modules: publishedModules },
    );
  }

  const deleted = await deletePresenter(id);
  if (!deleted) throw notFound('That presenter was not found.');

  return deleted;
}

export async function changeProfileRole(actor, id, input) {
  const { role, approvalStatus } = input;
  const target = await findProfileById(id);

  if (!target) throw notFound('That profile was not found.');

  // Role change protections
  if (role !== undefined) {
    if (actor?.profile?.id === id && role !== 'admin') {
      throw new AppError(
        409,
        'SELF_DEMOTION_BLOCKED',
        'You cannot remove your own admin access.',
      );
    }

    if (target.role === 'admin' && role !== 'admin') {
      const adminCount = await countAdmins();

      if (adminCount <= 1) {
        throw new AppError(
          409,
          'LAST_ADMIN',
          'At least one admin account must remain.',
        );
      }
    }
  }

  // Build update
  const updates = {};
  if (role !== undefined) updates.role = role;
  if (approvalStatus !== undefined) updates.approvalStatus = approvalStatus;

  return updateProfile(id, updates);
}
