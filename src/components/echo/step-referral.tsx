"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { useDestinationFacilities } from "@/lib/queries/referrals";
import { useSession } from "@/lib/session/session-context";
import { syncController } from "@/lib/offline/sync";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy } from "lucide-react";
import type { PrivacyMode } from "@/lib/supabase/database.types";

export function StepReferral({
  encounterId,
  privacyMode,
  consentId,
  onComplete,
}: {
  encounterId: string;
  privacyMode: PrivacyMode;
  consentId: string | null;
  onComplete: () => void;
}) {
  const { activeFacility } = useSession();
  const { data: facilities = [] } = useDestinationFacilities(activeFacility.facilityId);
  const [destination, setDestination] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [referral, setReferral] = useState<{ id: string; referral_code: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!referral) return;
    QRCode.toDataURL(referral.referral_code, { margin: 1, width: 220 }).then(setQrDataUrl);
  }, [referral]);

  async function createReferral() {
    if (!destination) return;
    setCreating(true);
    const referralId = crypto.randomUUID();
    try {
      await syncController.enqueueAndSync("referral", referralId, "rpc", {
        encounterId,
        destinationFacilityId: destination,
        privacyMode,
        consentId,
      });
      // The RPC assigns the real referral row/code server-side; fetch it back.
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("referrals")
        .select("id, referral_code")
        .eq("encounter_id", encounterId)
        .single();
      if (data) setReferral(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the referral");
    } finally {
      setCreating(false);
    }
  }

  if (referral) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-lg font-semibold">Referral created</h1>
        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt={`QR code for referral ${referral.referral_code}`} className="size-56" />
        )}
        <p className="text-xl font-mono font-semibold">{referral.referral_code}</p>
        <Button
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(referral.referral_code);
            toast.success("Referral code copied");
          }}
        >
          <Copy className="size-4" /> Copy code
        </Button>
        <Button className="w-full" onClick={onComplete}>Complete assessment</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Create referral</h1>
      <Select onValueChange={setDestination}>
        <SelectTrigger className="w-full"><SelectValue placeholder="Destination facility" /></SelectTrigger>
        <SelectContent>
          {facilities.map((f) => (
            <SelectItem key={f.id} value={f.id}>{f.name} ({f.code})</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Card>
        <CardContent className="p-3 text-sm text-muted-foreground">
          The referral QR code and code contain no patient information \u2014 they are safe to
          share or scan at the destination facility.
        </CardContent>
      </Card>
      <Button disabled={!destination || creating} onClick={createReferral}>
        {creating ? "Creating\u2026" : "Generate referral"}
      </Button>
    </div>
  );
}
