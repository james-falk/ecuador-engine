import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Sidebar } from "@/components/design/sidebar";
import { MobileShell } from "@/components/design/mobile-shell";
import { DrawerProvider } from "@/components/design/drawer";
import { DrawerHost } from "@/components/design/drawer-host";
import { getOwnedEntities } from "@/lib/queries/compliance";
import { getDefaultAccountId } from "@/lib/queries/accounts";
import { getTaskAssigneeOptions, getTaskCompanyOptions } from "@/lib/queries/tasks";
import { getCurrentPerson } from "@/lib/auth/session";
import "./globals.css";

const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Ecuador Engine",
  description: "Internal operations engine — Finca del Dragón × PureSol Imports",
};

// Mobile viewport — required so phones don't render at desktop scale.
// `viewport-fit=cover` lets the layout extend under iOS safe-area insets;
// the hamburger button's `top: 12px` is already inside the safe zone.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

const themeBootScript = `
  (function () {
    try {
      var stored = localStorage.getItem('ee-theme');
      document.documentElement.dataset.theme = stored || 'dark';
    } catch (_) {
      document.documentElement.dataset.theme = 'dark';
    }
  })();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Server-side: fetch the owned entities + default account + task picker
  // options once per render. Client components below receive these as plain
  // props (the task drawer, in particular, lives in DrawerHost and needs
  // assignee/company dropdown data on first render of any page).
  const [entities, defaultAccountId, taskAssignees, taskCompanies, currentPerson] = await Promise.all([
    getOwnedEntities(),
    getDefaultAccountId(),
    getTaskAssigneeOptions(),
    getTaskCompanyOptions(),
    getCurrentPerson(),
  ]);
  const currentUser = currentPerson
    ? { name: currentPerson.name, email: currentPerson.email }
    : null;

  return (
    <html lang="en" data-theme="dark" className={`${interTight.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="ee" style={{ margin: 0 }}>
        <DrawerProvider>
          <div className="ee-shell">
            <MobileShell>
              <Sidebar entities={entities} currentUser={currentUser} />
            </MobileShell>
            <main className="ee-main" style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
              {children}
            </main>
          </div>
          <DrawerHost
            defaultAccountId={defaultAccountId}
            taskAssignees={taskAssignees}
            taskCompanies={taskCompanies.map((c) => ({ id: c.id, name: c.name }))}
            ownerEntities={entities}
          />
        </DrawerProvider>
      </body>
    </html>
  );
}
