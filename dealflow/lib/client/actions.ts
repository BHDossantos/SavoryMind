/**
 * Branch-on-authed action layer. Components and pages call these instead
 * of touching `dealsRepo` or the `apiX` wrappers directly.
 *
 * Each action returns a canonical `Deal` (or `void` for delete).
 */
"use client";

import { dealsRepo } from "@/lib/storage";
import {
  apiCreateDeal,
  apiDeleteDeal,
  apiUpdateDeal,
  type DealUpdate,
} from "./api";
import type {
  AINarrative,
  Attachment,
  Deal,
  DealInput,
  PipelineStatus,
  Priority,
} from "@/lib/types";

export async function createDealAction(
  authed: boolean,
  input: DealInput,
): Promise<Deal> {
  if (authed) return apiCreateDeal(input);
  return dealsRepo.create(input);
}

export async function updateDealAction(
  authed: boolean,
  id: string,
  patch: DealUpdate,
): Promise<Deal | undefined> {
  if (authed) return apiUpdateDeal(id, patch);
  // localStorage path: aiNarrative=null means "clear"; everything else is a normal partial.
  const { aiNarrative, ...rest } = patch;
  if (aiNarrative === null) {
    dealsRepo.clearNarrative(id);
    return dealsRepo.update(id, rest);
  }
  return dealsRepo.update(
    id,
    aiNarrative === undefined
      ? rest
      : { ...rest, aiNarrative },
  );
}

export async function deleteDealAction(
  authed: boolean,
  id: string,
): Promise<void> {
  if (authed) {
    await apiDeleteDeal(id);
    return;
  }
  dealsRepo.remove(id);
}

export async function setStatusAction(
  authed: boolean,
  id: string,
  status: PipelineStatus,
): Promise<void> {
  if (authed) {
    await apiUpdateDeal(id, { status });
    return;
  }
  dealsRepo.setStatus(id, status);
}

export async function setPriorityAction(
  authed: boolean,
  id: string,
  priority: Priority,
): Promise<void> {
  if (authed) {
    await apiUpdateDeal(id, { priority });
    return;
  }
  dealsRepo.setPriority(id, priority);
}

export async function setNarrativeAction(
  authed: boolean,
  id: string,
  narrative: AINarrative,
): Promise<void> {
  if (authed) {
    await apiUpdateDeal(id, { aiNarrative: narrative });
    return;
  }
  dealsRepo.setNarrative(id, narrative);
}

export async function clearNarrativeAction(
  authed: boolean,
  id: string,
): Promise<void> {
  if (authed) {
    await apiUpdateDeal(id, { aiNarrative: null });
    return;
  }
  dealsRepo.clearNarrative(id);
}

export async function addAttachmentAction(
  authed: boolean,
  id: string,
  attachment: Attachment,
  currentAttachments: Attachment[] = [],
): Promise<void> {
  if (authed) {
    await apiUpdateDeal(id, {
      attachments: [...currentAttachments, attachment],
    });
    return;
  }
  dealsRepo.addAttachment(id, attachment);
}

export async function removeAttachmentAction(
  authed: boolean,
  id: string,
  attachmentId: string,
  currentAttachments: Attachment[] = [],
): Promise<void> {
  if (authed) {
    await apiUpdateDeal(id, {
      attachments: currentAttachments.filter((a) => a.id !== attachmentId),
    });
    return;
  }
  dealsRepo.removeAttachment(id, attachmentId);
}
