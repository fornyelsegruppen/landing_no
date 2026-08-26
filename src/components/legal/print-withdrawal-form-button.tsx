"use client";

export function PrintWithdrawalFormButton({ label }: { label: string }) {
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 font-bold text-black transition hover:brightness-110 print:hidden"
      onClick={() => window.print()}
      type="button"
    >
      {label}
    </button>
  );
}

