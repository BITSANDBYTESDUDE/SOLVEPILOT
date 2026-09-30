import { ATTACHMENT_PROCESSING_STATUS, type AttachmentProcessingStatus } from "@/types/domain";

const ALLOWED_TRANSITIONS: Record<
  AttachmentProcessingStatus,
  readonly AttachmentProcessingStatus[]
> = {
  uploaded: ["queued"],
  queued: ["processing"],
  processing: ["processed", "failed"],
  processed: [],
  failed: ["queued"],
};

export function isAttachmentProcessingStatus(value: unknown): value is AttachmentProcessingStatus {
  return (ATTACHMENT_PROCESSING_STATUS as readonly unknown[]).includes(value);
}

export function canTransitionAttachmentProcessingStatus(
  currentStatus: AttachmentProcessingStatus,
  nextStatus: AttachmentProcessingStatus,
): boolean {
  return ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function getAvailableAttachmentProcessingTransitions(
  status: AttachmentProcessingStatus,
): AttachmentProcessingStatus[] {
  return [...ALLOWED_TRANSITIONS[status]];
}
