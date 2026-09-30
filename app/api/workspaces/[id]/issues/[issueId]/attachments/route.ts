import { type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/auth/guards";
import { MAX_ATTACHMENTS_PER_REQUEST } from "@/lib/constants/attachments";
import { ValidationError, PayloadTooLargeError } from "@/lib/errors";
import { jsonCreated, jsonError, jsonOk } from "@/lib/http/api-response";
import {
  assertCanManageIssueAttachments,
  getMaxAttachmentSizeBytes,
  listIssueAttachments,
  uploadIssueAttachments,
} from "@/services/issue-attachment.service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; issueId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId, issueId } = await context.params;
    const attachments = await listIssueAttachments(user.id, workspaceId, issueId);
    return jsonOk({ attachments });
  } catch (error) {
    return jsonError(error, { route: "GET /api/workspaces/[id]/issues/[issueId]/attachments" });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireApiUser();
    const { id: workspaceId, issueId } = await context.params;

    // Authorize before parsing potentially large multipart content; the service
    // checks again immediately before writing.
    await assertCanManageIssueAttachments(user.id, workspaceId, issueId);

    const declaredLength = Number(request.headers.get("content-length"));
    const maxBodyBytes = getMaxAttachmentSizeBytes() * MAX_ATTACHMENTS_PER_REQUEST + 1024 * 1024;
    if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
      throw new PayloadTooLargeError("The attachment upload is too large.");
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ValidationError("Upload a valid multipart form with a files field.");
    }

    const entries = form.getAll("files");
    if (entries.some((entry) => !(entry instanceof File))) {
      throw new ValidationError("The files field must contain uploaded files.");
    }
    const files = entries.filter((entry): entry is File => entry instanceof File);
    if (files.length > MAX_ATTACHMENTS_PER_REQUEST) {
      throw new ValidationError(
        `You can upload up to ${MAX_ATTACHMENTS_PER_REQUEST} files at a time.`,
      );
    }

    const attachments = await uploadIssueAttachments(user.id, workspaceId, issueId, files);
    return jsonCreated({ attachments });
  } catch (error) {
    return jsonError(error, { route: "POST /api/workspaces/[id]/issues/[issueId]/attachments" });
  }
}
