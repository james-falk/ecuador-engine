"use server";

// Server actions for the /admin/google-auth page. Kept thin — the heavy
// lifting lives in src/lib/google/oauth.ts.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthorizeUrl, disconnectAccount } from "@/lib/google/oauth";

export async function startConnectAction() {
  const url = getAuthorizeUrl();
  redirect(url);
}

export async function disconnectAccountAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return;
  await disconnectAccount(email);
  revalidatePath("/admin/google-auth");
}
