"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useSession } from "@/lib/session/session-context";
import { useReferrals } from "@/lib/queries/referrals";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

const STATUS_VARIANT: Record<string, "default" | "outline" | "secondary" | "destructive"> = {
  created: "secondary",
  arrived: "default",
  closed: "outline",
  cancelled: "destructive",
};

export default function ReferralsPage() {
  const { activeFacility } = useSession();
  const [search, setSearch] = useState("");
  const { data: referrals = [], isLoading } = useReferrals(activeFacility.facilityId, search);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Referrals</h1>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by referral code"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading\u2026</p>}
      {!isLoading && referrals.length === 0 && (
        <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">No referrals yet</CardContent></Card>
      )}

      <div className="flex flex-col gap-2">
        {referrals.map((r) => {
          const incentive = Array.isArray(r.incentive_evaluations) ? r.incentive_evaluations[0] : null;
          return (
            <Link key={r.id} href={`/referrals/${r.id}`}>
              <Card>
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-mono font-medium">{r.referral_code}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </p>
                    {incentive?.eligible && <Badge variant="outline" className="mt-1">Incentive eligible</Badge>}
                  </div>
                  <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
