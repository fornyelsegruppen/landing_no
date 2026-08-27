import { EmployeeAdmin } from "@/components/admin-v2/employee-admin";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";

export const dynamic = "force-dynamic";

function safeReturnTo(value?: string) {
  return value && /^\/admin-v2\/cases\/\d+(?:#work-planning)?$/.test(value)
    ? value
    : undefined;
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await requireAdminUser();
  const copy = getAdminV2Copy(user.interfaceLanguage);
  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = safeReturnTo(rawReturnTo);
  const result = await (
    await getPayload()
  ).find({
    collection: "users",
    depth: 0,
    limit: 200,
    pagination: false,
    overrideAccess: true,
    sort: "displayName",
    where: { role: { equals: "worker" } },
  });
  const employees = result.docs.map((item) => ({
    active: Boolean(item.active),
    displayName: item.displayName || undefined,
    email: item.email,
    id: item.id,
    interfaceLanguage: item.interfaceLanguage,
    phone: item.phone || undefined,
  }));
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-accent text-xs font-bold tracking-[.2em] uppercase">
          {copy.control}
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          {copy.employeesAdmin.title}
        </h1>
        <p className="text-muted-foreground mt-2">
          {copy.employeesAdmin.intro}
        </p>
      </header>
      <EmployeeAdmin
        employees={employees}
        locale={user.interfaceLanguage}
        returnTo={returnTo}
      />
    </div>
  );
}
