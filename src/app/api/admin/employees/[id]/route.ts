import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { employeeUpdateSchema } from "@/lib/employees/employee-input";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { userIsAdmin } from "@/payload/access/roles";

type RouteContext = { params: Promise<{ id: string }> };

async function requireEmployee(request: Request, context: RouteContext) {
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user)
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  if (!userIsAdmin(user))
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };

  const { id } = await context.params;
  if (!/^\d+$/.test(id)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Invalid employee" },
        { status: 400 },
      ),
    };
  }
  const existing = await payload.findByID({
    collection: "users",
    id: Number(id),
    depth: 0,
    overrideAccess: true,
  });
  if (existing.role !== "worker") {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Only employee accounts can be changed here" },
        { status: 409 },
      ),
    };
  }
  return { existing, ok: true as const, payload, user };
}

export async function PATCH(request: Request, context: RouteContext) {
  const correlationId = correlationIdFromHeaders(request.headers);
  const resolved = await requireEmployee(request, context);
  if (!resolved.ok) return resolved.response;

  const parsed = employeeUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid employee details" },
      { status: 400 },
    );
  }

  const { existing, payload, user } = resolved;
  const { password, ...profile } = parsed.data;
  const data = {
    ...profile,
    ...(password ? { password } : {}),
  };
  const changedFields = Object.keys(parsed.data).filter(
    (field) => field !== "password" || parsed.data.password !== "",
  );
  try {
    const updated = await payload.update({
      collection: "users",
      id: existing.id,
      overrideAccess: true,
      data,
    });
    const activeOnly =
      changedFields.length === 1 && changedFields[0] === "active";
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      action: activeOnly
        ? parsed.data.active
          ? "employee.activate"
          : "employee.deactivate"
        : "employee.update",
      actorId: user.id,
      before: {
        active: existing.active,
        displayName: existing.displayName,
        email: existing.email,
        interfaceLanguage: existing.interfaceLanguage,
        phone: existing.phone,
      },
      after: {
        active: updated.active,
        displayName: updated.displayName,
        email: updated.email,
        interfaceLanguage: updated.interfaceLanguage,
        phone: updated.phone,
      },
      changedFields,
      correlationId,
      entityId: existing.id,
      entityType: "user",
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        code: "EMPLOYEE_UPDATE_CONFLICT",
        error: "Employee details could not be saved",
      },
      { status: 409 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const correlationId = correlationIdFromHeaders(request.headers);
  const resolved = await requireEmployee(request, context);
  if (!resolved.ok) return resolved.response;

  const { existing, payload, user } = resolved;
  const usage = await Promise.all([
    payload.count({
      collection: "work-orders",
      overrideAccess: true,
      where: { assignedWorker: { equals: existing.id } },
    }),
    payload.count({
      collection: "leads",
      overrideAccess: true,
      where: { assignedTo: { equals: existing.id } },
    }),
    payload.count({
      collection: "audit-events",
      overrideAccess: true,
      where: { actor: { equals: existing.id } },
    }),
    payload.count({
      collection: "invoice-records",
      overrideAccess: true,
      where: { assignedTo: { equals: existing.id } },
    }),
    payload.count({
      collection: "warranties",
      overrideAccess: true,
      where: { approvedBy: { equals: existing.id } },
    }),
  ]);
  if (usage.some((result) => result.totalDocs > 0)) {
    return NextResponse.json(
      {
        code: "EMPLOYEE_HAS_HISTORY",
        error: "An employee with operational history cannot be deleted",
      },
      { status: 409 },
    );
  }

  try {
    await payload.delete({
      collection: "users",
      id: existing.id,
      overrideAccess: true,
    });
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      action: "employee.delete",
      actorId: user.id,
      changedFields: [
        "active",
        "displayName",
        "email",
        "interfaceLanguage",
        "phone",
        "role",
      ],
      correlationId,
      entityId: existing.id,
      entityType: "user",
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        code: "EMPLOYEE_DELETE_CONFLICT",
        error: "Employee could not be deleted",
      },
      { status: 409 },
    );
  }
}
