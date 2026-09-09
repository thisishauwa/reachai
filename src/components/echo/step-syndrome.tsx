"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import { useSyndromes } from "@/lib/queries/reference";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StepSyndrome({
  encounterCode,
  onSelect,
}: {
  encounterCode: string;
  onSelect: (syndromeId: string, labelEn: string) => void;
}) {
  const { data: syndromes = [], isLoading } = useSyndromes();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Chief complaint</h1>
        <p className="text-sm text-muted-foreground">{encounterCode}</p>
      </div>

      {isLoading && <Skeleton className="h-40 w-full" />}

      <div className="flex flex-col gap-2">
        {syndromes.map((s) => (
          <Card
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelected(s.id)}
            className={cn("cursor-pointer", selected === s.id && "border-primary ring-2 ring-primary/30")}
          >
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium">{s.label_en}</p>
                <p className="text-xs text-muted-foreground">{s.label_ha}</p>
              </div>
              {s.audio_storage_path ? (
                <Badge variant="outline"><Volume2 className="size-3.5" /></Badge>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        disabled={!selected}
        onClick={() => {
          const syndrome = syndromes.find((s) => s.id === selected);
          if (syndrome) onSelect(syndrome.id, syndrome.label_en);
        }}
      >
        Continue
      </Button>
    </div>
  );
}
