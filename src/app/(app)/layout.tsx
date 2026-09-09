import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SessionProvider } from "@/lib/session/session-context";
import { BottomNav } from "@/components/nav/bottom-nav";
import { Header } from "@/components/nav/header";
import { ServiceWorkerRegistration } from "@/components/providers/service-worker-registration";
import { OfflineBootstrap } from "@/components/providers/offline-bootstrap";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SessionData } from "@/lib/session/types";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, staff_id, preferred_workflow")
    .eq("id", userData.user.id)
    .single();

  const { data: memberships } = await supabase
    .from("facility_memberships")
    .select(
      "facility_id, organization_id, role, is_active, facilities(name, code)",
    )
    .eq("user_id", userData.user.id)
    .eq("is_active", true);

  if (!profile || !memberships || memberships.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No facility assigned</CardTitle>
            <CardDescription>
              Your account is not yet linked to an active facility membership.
              Ask a facility admin to grant access before you can use the
              clinical app.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Signed in as {userData.user.email}
          </CardContent>
        </Card>
      </div>
    );
  }

  const session: SessionData = {
    userId: profile.id,
    displayName: profile.display_name,
    staffId: profile.staff_id,
    preferredWorkflow: profile.preferred_workflow,
    memberships: memberships.map((m) => ({
      facilityId: m.facility_id,
      organizationId: m.organization_id,
      facilityName:
        (m.facilities as unknown as { name: string; code: string } | null)
          ?.name ?? "Facility",
      facilityCode:
        (m.facilities as unknown as { name: string; code: string } | null)
          ?.code ?? "",
      role: m.role,
    })),
  };

  return (
    <SessionProvider session={session}>
      <ServiceWorkerRegistration />
      <OfflineBootstrap />
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4 pb-6">
        {children}
      </main>
      <BottomNav />
    </SessionProvider>
  );
}
