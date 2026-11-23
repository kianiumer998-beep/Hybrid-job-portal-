import { AsyncLocalStorage } from 'async_hooks';

export interface AuditRequestContext {
  auditRecorded: boolean;
}

const auditRequestStorage = new AsyncLocalStorage<AuditRequestContext>();

export function runWithAuditRequestContext<T>(
  context: AuditRequestContext,
  callback: () => T
): T {
  return auditRequestStorage.run(context, callback);
}

export function markAuditRequestRecorded(): void {
  const context = auditRequestStorage.getStore();
  if (context) context.auditRecorded = true;
}
