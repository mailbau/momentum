"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useArchivedCards, useRestoreCard } from "@/hooks/use-board"

export function ArchivedDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { data: cards, isLoading } = useArchivedCards(open)
    const restore = useRestoreCard()

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Archived tasks</SheetTitle>
                    <SheetDescription>Restore a task if you archived it by mistake.</SheetDescription>
                </SheetHeader>
                <div className="space-y-2 px-4 pb-4">
                    {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
                    {cards?.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nothing archived yet.</p>
                    )}
                    {cards?.map((c) => (
                        <div key={c.id} className="rounded-lg border border-border p-3">
                            <p className="text-sm font-medium">{c.title}</p>
                            {c.archive_reason && (
                                <p className="mt-0.5 text-xs text-muted-foreground">{c.archive_reason}</p>
                            )}
                            <Button
                                size="sm"
                                variant="outline"
                                className="mt-2"
                                onClick={() => restore.mutate(c.id)}
                                disabled={restore.isPending}
                            >
                                Restore
                            </Button>
                        </div>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    )
}
