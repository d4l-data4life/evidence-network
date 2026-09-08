// A study/dataset is shown to *other* authenticated users only when it is BOTH
// marked AUTHENTICATED (owner intent) AND APPROVED by a coordinator. Owners and
// team members always see their own records regardless.
//
// These are Prisma `where` fragments reused across listings, detail guards, and
// the matcher so the rule lives in one place.

export const PUBLICLY_VISIBLE = {
  visibility: "AUTHENTICATED" as const,
  approvalStatus: "APPROVED" as const,
};

export function isPubliclyVisible(record: {
  visibility: string;
  approvalStatus: string;
}): boolean {
  return record.visibility === "AUTHENTICATED" && record.approvalStatus === "APPROVED";
}
