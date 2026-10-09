"use client"

import { useEffect, useState } from "react"
import { Star, Trash2, Plus, X, Link as LinkIcon, Play, Square, Archive } from "lucide-react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { useStrategies } from "@/hooks/use-board"
import {
    useCardDetail,
    useUpdateCard,
    useChecklistMutations,
    useLinkMutations,
    useTimer,
} from "@/hooks/use-card-detail"
import { useArchiveCard, useDeleteCard } from "@/hooks/use-board"
import type { Difficulty, Priority } from "@/types/card"

export function CardDetailSheet({ cardId, onClose }: { cardId: string | null; onClose: () => void }) {
    const { data: card, isLoading } = useCardDetail(cardId)
    const { data: strategies } = useStrategies()
    const update = useUpdateCard(cardId ?? "")
    const checklist = useChecklistMutations(cardId ?? "")
    const links = useLinkMutations(cardId ?? "")
    const timer = useTimer(cardId ?? "")
    const archiveCard = useArchiveCard()
    const deleteCard = useDeleteCard()

    const [description, setDescription] = useState("")
    const [priorKnowledge, setPriorKnowledge] = useState("")
    const [notes, setNotes] = useState("")
    const [newChecklistText, setNewChecklistText] = useState("")
    const [newLinkUrl, setNewLinkUrl] = useState("")
    const [newLinkLabel, setNewLinkLabel] = useState("")
    const [archiveReason, setArchiveReason] = useState("")
    const [archiveOpen, setArchiveOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)

    useEffect(() => {
        if (card) {
            setDescription(card.description)
            setPriorKnowledge(card.prior_knowledge)
            setNotes(card.notes)
        }
    }, [card])

    const open = !!cardId
    const stage = card?.stage

    const canEditPriorKnowledge = stage === "planning"
    const canEditPreTest = stage !== "reflection"
    const canEditPostTestAndNotes = stage === "controlling" || stage === "reflection"
    const canEditRating = stage === "reflection"
    const canUseTimer = stage !== "reflection"

    const handleClose = () => {
        setArchiveReason("")
        setArchiveOpen(false)
        setDeleteOpen(false)
        onClose()
    }

    return (
        <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                {isLoading || !card ? (
                    <div className="p-6 text-sm text-muted-foreground">Loading...</div>
                ) : (
                    <>
                        <SheetHeader>
                            <SheetTitle className="text-xs font-medium text-primary">
                                {card.course_code} · {card.course_name}
                            </SheetTitle>
                            <SheetDescription className="text-base font-semibold text-foreground">
                                {card.title}
                            </SheetDescription>
                        </SheetHeader>

                        <div className="space-y-6 px-4 pb-4">
                            {/* Description */}
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    onBlur={() => {
                                        if (description !== card.description) update.mutate({ description })
                                    }}
                                    placeholder="Add details about this task..."
                                    rows={3}
                                />
                            </div>

                            {/* Timer */}
                            <div className="flex items-center justify-between rounded-lg border border-border p-3">
                                <div>
                                    <p className="text-sm font-medium">Study timer</p>
                                    <p className="text-xs text-muted-foreground">
                                        {card.study_minutes < 1
                                            ? "No time logged yet"
                                            : `${Math.round(card.study_minutes)} min logged`}
                                    </p>
                                </div>
                                {canUseTimer ? (
                                    <Button
                                        size="sm"
                                        variant={card.timer_running ? "destructive" : "default"}
                                        onClick={() =>
                                            card.timer_running ? timer.stop.mutate() : timer.start.mutate()
                                        }
                                        disabled={timer.start.isPending || timer.stop.isPending}
                                    >
                                        {card.timer_running ? (
                                            <>
                                                <Square className="h-3.5 w-3.5" /> Stop
                                            </>
                                        ) : (
                                            <>
                                                <Play className="h-3.5 w-3.5" /> Start
                                            </>
                                        )}
                                    </Button>
                                ) : (
                                    <span className="text-xs text-muted-foreground">Not editable in Reflection</span>
                                )}
                            </div>

                            {/* Properties */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>Priority</Label>
                                    <Select
                                        value={card.priority}
                                        onValueChange={(v) => v && update.mutate({ priority: v as Priority })}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(["low", "medium", "high", "critical"] as const).map((p) => (
                                                <SelectItem key={p} value={p} className="capitalize">
                                                    {p}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Difficulty</Label>
                                    <Select
                                        value={card.difficulty}
                                        onValueChange={(v) => v && update.mutate({ difficulty: v as Difficulty })}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(["easy", "medium", "hard", "expert"] as const).map((d) => (
                                                <SelectItem key={d} value={d} className="capitalize">
                                                    {d}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Learning strategy</Label>
                                <Select
                                    value={card.strategy_id ?? undefined}
                                    onValueChange={(v) => v && update.mutate({ strategy_id: v })}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Pick a strategy" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {strategies?.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Prior knowledge (Planning only) */}
                            <div className="space-y-2">
                                <Label htmlFor="prior-knowledge">
                                    What do I already know about this?
                                </Label>
                                <Textarea
                                    id="prior-knowledge"
                                    value={priorKnowledge}
                                    onChange={(e) => setPriorKnowledge(e.target.value)}
                                    onBlur={() => {
                                        if (priorKnowledge !== card.prior_knowledge && canEditPriorKnowledge) {
                                            update.mutate({ prior_knowledge: priorKnowledge })
                                        }
                                    }}
                                    disabled={!canEditPriorKnowledge}
                                    placeholder="Jot down what you recall before you start..."
                                    rows={2}
                                />
                                {!canEditPriorKnowledge && (
                                    <p className="text-xs text-muted-foreground">Only editable in Planning</p>
                                )}
                            </div>

                            {/* Grades */}
                            <div className="grid grid-cols-2 gap-3">
                                <GradeField
                                    label="Pre-test"
                                    value={card.pre_test}
                                    disabled={!canEditPreTest}
                                    disabledHint="Not editable in Reflection"
                                    onSave={(v) => update.mutate({ pre_test: v })}
                                />
                                <GradeField
                                    label="Post-test"
                                    value={card.post_test}
                                    disabled={!canEditPostTestAndNotes}
                                    disabledHint="Only in Controlling or Reflection"
                                    onSave={(v) => update.mutate({ post_test: v })}
                                />
                            </div>

                            {/* Checklist */}
                            <div className="space-y-2">
                                <Label>Checklist</Label>
                                <div className="space-y-1.5">
                                    {card.checklist.map((item) => (
                                        <div key={item.id} className="flex items-center gap-2">
                                            <Checkbox
                                                checked={item.done}
                                                onCheckedChange={(checked) =>
                                                    checklist.update.mutate({
                                                        itemId: item.id,
                                                        text: item.text,
                                                        done: checked === true,
                                                    })
                                                }
                                            />
                                            <span
                                                className={cn(
                                                    "flex-1 text-sm",
                                                    item.done && "text-muted-foreground line-through",
                                                )}
                                            >
                                                {item.text}
                                            </span>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6"
                                                onClick={() => checklist.remove.mutate(item.id)}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault()
                                        if (!newChecklistText.trim()) return
                                        checklist.add.mutate(newChecklistText.trim())
                                        setNewChecklistText("")
                                    }}
                                    className="flex gap-2"
                                >
                                    <Input
                                        value={newChecklistText}
                                        onChange={(e) => setNewChecklistText(e.target.value)}
                                        placeholder="Add a step..."
                                        className="h-8 text-sm"
                                    />
                                    <Button type="submit" size="icon" variant="outline" className="h-8 w-8 shrink-0">
                                        <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                </form>
                            </div>

                            {/* Links */}
                            <div className="space-y-2">
                                <Label>Links</Label>
                                <div className="space-y-1.5">
                                    {card.links.map((link) => (
                                        <div key={link.id} className="flex items-center gap-2">
                                            <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            <a
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 truncate text-sm text-primary hover:underline"
                                            >
                                                {link.label || link.url}
                                            </a>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6"
                                                onClick={() => links.remove.mutate(link.id)}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault()
                                        if (!newLinkUrl.trim()) return
                                        links.add.mutate(
                                            { url: newLinkUrl.trim(), label: newLinkLabel.trim() },
                                            { onSuccess: () => { setNewLinkUrl(""); setNewLinkLabel("") } },
                                        )
                                    }}
                                    className="flex gap-2"
                                >
                                    <Input
                                        value={newLinkLabel}
                                        onChange={(e) => setNewLinkLabel(e.target.value)}
                                        placeholder="Label"
                                        className="h-8 w-24 text-sm"
                                    />
                                    <Input
                                        value={newLinkUrl}
                                        onChange={(e) => setNewLinkUrl(e.target.value)}
                                        placeholder="https://..."
                                        className="h-8 flex-1 text-sm"
                                    />
                                    <Button type="submit" size="icon" variant="outline" className="h-8 w-8 shrink-0">
                                        <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                </form>
                            </div>

                            {/* Notes (Controlling/Reflection only) */}
                            <div className="space-y-2">
                                <Label htmlFor="notes">Summary / notes</Label>
                                <Textarea
                                    id="notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    onBlur={() => {
                                        if (notes !== card.notes && canEditPostTestAndNotes) {
                                            update.mutate({ notes })
                                        }
                                    }}
                                    disabled={!canEditPostTestAndNotes}
                                    placeholder="What did you learn?"
                                    rows={3}
                                />
                                {!canEditPostTestAndNotes && (
                                    <p className="text-xs text-muted-foreground">
                                        Only editable in Controlling or Reflection
                                    </p>
                                )}
                            </div>

                            {/* Rating (Reflection only) */}
                            <div className="space-y-2">
                                <Label>Reflection rating</Label>
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <button
                                            key={n}
                                            type="button"
                                            disabled={!canEditRating}
                                            onClick={() => update.mutate({ rating: n })}
                                            className="disabled:opacity-40"
                                            aria-label={`Rate ${n} out of 5`}
                                        >
                                            <Star
                                                className={cn(
                                                    "h-5 w-5",
                                                    (card.rating ?? 0) >= n
                                                        ? "fill-accent text-accent"
                                                        : "text-muted-foreground",
                                                )}
                                            />
                                        </button>
                                    ))}
                                </div>
                                {!canEditRating && (
                                    <p className="text-xs text-muted-foreground">Only editable in Reflection</p>
                                )}
                            </div>
                        </div>

                        <SheetFooter className="flex-row justify-between border-t pt-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setArchiveOpen(true)}
                            >
                                <Archive className="h-3.5 w-3.5" /> Archive
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeleteOpen(true)}
                                disabled={card.timer_running}
                                title={card.timer_running ? "Stop the timer before deleting" : undefined}
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
                        </SheetFooter>

                        {/* Archive confirmation */}
                        <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Archive this task?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Tell us why — it helps you notice patterns later. You can restore it
                                        anytime from the archive.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <Input
                                    value={archiveReason}
                                    onChange={(e) => setArchiveReason(e.target.value)}
                                    placeholder="e.g. No longer relevant to my goal"
                                    autoFocus
                                />
                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setArchiveReason("")}>
                                        Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                        disabled={!archiveReason.trim()}
                                        onClick={() => {
                                            archiveCard.mutate(
                                                { cardId: card.id, reason: archiveReason.trim() },
                                                { onSuccess: handleClose },
                                            )
                                        }}
                                    >
                                        Archive
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                        {/* Delete confirmation */}
                        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete this task permanently?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This can't be undone. If you just want it out of the way, archive it
                                        instead.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        className="bg-destructive text-white hover:bg-destructive/90"
                                        onClick={() => deleteCard.mutate(card.id, { onSuccess: handleClose })}
                                    >
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}

function GradeField({
    label,
    value,
    disabled,
    disabledHint,
    onSave,
}: {
    label: string
    value: number | null
    disabled: boolean
    disabledHint: string
    onSave: (v: number) => void
}) {
    const [local, setLocal] = useState(value?.toString() ?? "")

    useEffect(() => setLocal(value?.toString() ?? ""), [value])

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Input
                type="number"
                min={0}
                max={100}
                value={local}
                disabled={disabled}
                onChange={(e) => setLocal(e.target.value)}
                onBlur={() => {
                    const n = Number(local)
                    if (local !== "" && !Number.isNaN(n) && n !== value) onSave(n)
                }}
                placeholder="0-100"
            />
            {disabled && <p className="text-xs text-muted-foreground">{disabledHint}</p>}
        </div>
    )
}
