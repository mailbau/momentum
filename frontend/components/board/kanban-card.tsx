"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { Badge } from "@/components/ui/badge"
import type { CardSummary } from "@/types/card"
import { cn } from "@/lib/utils"

const PRIORITY_STYLE: Record<CardSummary["priority"], string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-stage-planning/15 text-stage-planning",
    high: "bg-stage-monitoring/15 text-stage-monitoring",
    critical: "bg-destructive/15 text-destructive",
}

export function KanbanCard({ card, onOpen }: { card: CardSummary; onOpen: (id: string) => void }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: card.id,
        data: { card },
    })

    const style = transform
        ? { transform: CSS.Translate.toString(transform) }
        : undefined

    return (
        <button
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={() => onOpen(card.id)}
            className={cn(
                "w-full rounded-xl border border-border bg-card p-3 text-left shadow-sm",
                "transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "touch-none cursor-grab active:cursor-grabbing",
                isDragging && "opacity-40",
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-primary">{card.course_code}</span>
                <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", PRIORITY_STYLE[card.priority])}>
                    {card.priority}
                </Badge>
            </div>
            <p className="mt-1 text-sm font-medium leading-snug text-card-foreground line-clamp-2">
                {card.title}
            </p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="capitalize">{card.difficulty}</span>
                {card.strategy_name && (
                    <span className="truncate max-w-[60%] text-right" title={card.strategy_name}>
                        {card.strategy_name.split(" - ")[0]}
                    </span>
                )}
            </div>
        </button>
    )
}
