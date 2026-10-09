"use client"

import { useState } from "react"
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core"
import { Archive, LogOut, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { KanbanColumn } from "./kanban-column"
import { KanbanCard } from "./kanban-card"
import { AddCardDialog } from "./add-card-dialog"
import { CardDetailSheet } from "./card-detail-sheet"
import { ArchivedDrawer } from "./archived-drawer"
import { useBoard, useMoveCard } from "@/hooks/use-board"
import { useAuth } from "@/lib/auth/auth-context"
import { STAGE_ORDER, type CardSummary, type Stage } from "@/types/card"

export function KanbanBoard() {
    const { data: board, isLoading } = useBoard()
    const moveCard = useMoveCard()
    const { user, logout } = useAuth()

    const [activeCard, setActiveCard] = useState<CardSummary | null>(null)
    const [openCardId, setOpenCardId] = useState<string | null>(null)
    const [addOpen, setAddOpen] = useState(false)
    const [archivedOpen, setArchivedOpen] = useState(false)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    )

    const handleDragStart = (e: DragStartEvent) => {
        setActiveCard((e.active.data.current?.card as CardSummary) ?? null)
    }

    const handleDragEnd = (e: DragEndEvent) => {
        setActiveCard(null)
        const { active, over } = e
        if (!over || !board) return

        const targetStage = over.id as Stage
        const card = active.data.current?.card as CardSummary | undefined
        if (!card || card.stage === targetStage) return

        const targetCards = board[targetStage]
        const nextPosition =
            targetCards.length > 0 ? Math.max(...targetCards.map((c) => c.position)) + 1024 : 1024

        moveCard.mutate({ cardId: card.id, stage: targetStage, position: nextPosition })
    }

    return (
        <div className="flex h-dvh flex-col bg-background">
            <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
                <div>
                    <h1 className="text-lg font-semibold text-foreground">Momentum</h1>
                    <p className="text-xs text-muted-foreground">
                        {user ? `${user.first_name}'s board` : "Loading..."}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                        <Plus className="h-3.5 w-3.5" /> New task
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setArchivedOpen(true)}>
                        <Archive className="h-3.5 w-3.5" /> Archived
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => logout()} aria-label="Sign out">
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </header>

            <div className="flex-1 overflow-x-auto p-4 sm:p-6">
                {isLoading || !board ? (
                    <div className="flex gap-4">
                        {STAGE_ORDER.map((s) => (
                            <Skeleton key={s} className="h-96 min-w-72 flex-1 rounded-2xl" />
                        ))}
                    </div>
                ) : (
                    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                        <div className="flex h-full gap-4">
                            {STAGE_ORDER.map((stage) => (
                                <KanbanColumn
                                    key={stage}
                                    stage={stage}
                                    cards={board[stage]}
                                    onOpenCard={setOpenCardId}
                                    onAddCard={stage === "planning" ? () => setAddOpen(true) : undefined}
                                />
                            ))}
                        </div>
                        <DragOverlay>
                            {activeCard && <KanbanCard card={activeCard} onOpen={() => {}} />}
                        </DragOverlay>
                    </DndContext>
                )}
            </div>

            <AddCardDialog open={addOpen} onOpenChange={setAddOpen} />
            <CardDetailSheet cardId={openCardId} onClose={() => setOpenCardId(null)} />
            <ArchivedDrawer open={archivedOpen} onOpenChange={setArchivedOpen} />
        </div>
    )
}
