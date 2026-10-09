"use client"

import { useDroppable } from "@dnd-kit/core"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { KanbanCard } from "./kanban-card"
import type { CardSummary, Stage } from "@/types/card"
import { cn } from "@/lib/utils"

const STAGE_META: Record<Stage, { label: string; hint: string; color: string }> = {
    planning: {
        label: "Planning",
        hint: "What are you going to work on?",
        color: "bg-stage-planning",
    },
    monitoring: {
        label: "Monitoring",
        hint: "Pull a task here once you start studying it.",
        color: "bg-stage-monitoring",
    },
    controlling: {
        label: "Controlling",
        hint: "Review what you've studied and record the result.",
        color: "bg-stage-controlling",
    },
    reflection: {
        label: "Reflection",
        hint: "Wrap up with a rating and a short reflection.",
        color: "bg-stage-reflection",
    },
}

interface Props {
    stage: Stage
    cards: CardSummary[]
    onOpenCard: (id: string) => void
    onAddCard?: () => void
}

export function KanbanColumn({ stage, cards, onOpenCard, onAddCard }: Props) {
    const meta = STAGE_META[stage]
    const { setNodeRef, isOver } = useDroppable({ id: stage, data: { stage } })

    return (
        <div className="flex min-w-72 flex-1 flex-col rounded-2xl bg-muted/50">
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", meta.color)} aria-hidden="true" />
                    <h2 className="text-sm font-semibold text-foreground">{meta.label}</h2>
                    <span className="text-xs text-muted-foreground">{cards.length}</span>
                </div>
                {stage === "planning" && onAddCard && (
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={onAddCard}
                        aria-label="Add a task to Planning"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                )}
            </div>

            <div
                ref={setNodeRef}
                className={cn(
                    "flex min-h-40 flex-1 flex-col gap-2 overflow-y-auto rounded-xl px-2 pb-3 transition-colors",
                    isOver && "bg-primary/5 ring-2 ring-primary/30",
                )}
            >
                {cards.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                        {meta.hint}
                    </div>
                ) : (
                    cards.map((card) => <KanbanCard key={card.id} card={card} onOpen={onOpenCard} />)
                )}
            </div>
        </div>
    )
}
