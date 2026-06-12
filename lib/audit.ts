import { prisma } from "./prisma";

export type AuditAction =
  | "CREATE" | "UPDATE" | "DELETE" | "RESTORE"
  | "LOGIN" | "LOGIN_FAILED" | "EXPORT" | "BACKUP" | "RESTORE_DB";

interface AuditOpts {
  userId?:   string | null;
  userName?: string | null;
  action:    AuditAction;
  entity:    string;
  entityId?: string | null;
  details?:  Record<string, unknown> | string | null;
  ip?:       string | null;
}

export async function logAudit(opts: AuditOpts): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId:   opts.userId   ?? null,
        userName: opts.userName ?? null,
        action:   opts.action,
        entity:   opts.entity,
        entityId: opts.entityId ?? null,
        details:  opts.details
          ? typeof opts.details === "string"
            ? opts.details
            : JSON.stringify(opts.details)
          : null,
        ip: opts.ip ?? null,
      },
    });
  } catch {
    // Audit failure must never break the main operation
  }
}

export function getIp(req: { headers: { get: (h: string) => string | null } }): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}
