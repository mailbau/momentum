"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as boardApi from "@/lib/api/board"
import type { Board, Stage } from "@/types/card"
import { ApiError } from "@/lib/api/client"

export const boardKey = ["board"] as const

export function useBoard() {
    return useQuery({ queryKey: boardKey, queryFn: boardApi.getBoard })
}

export function useCourses() {
    return useQuery({ queryKey: ["courses"], queryFn: boardApi.getCourses, staleTime: 5 * 60_000 })
}

export function useStrategies() {
    return useQuery({ queryKey: ["strategies"], queryFn: boardApi.getStrategies, staleTime: 5 * 60_000 })
}

export function useCreateCard() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: boardApi.createCard,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: boardKey })
        },
        onError: (err) => {
            toast.error(err instanceof ApiError ? err.message : "Failed to create card")
        },
    })
}

/**
 * Moves a card to a new stage, updating the board cache immediately
 * (so the drag feels instant) and rolling back to the pre-drag snapshot
 * if the server call fails.
 */
export function useMoveCard() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ cardId, stage, position }: { cardId: string; stage: Stage; position: number }) =>
            boardApi.moveCard(cardId, stage, position),
        onMutate: async ({ cardId, stage, position }) => {
            await qc.cancelQueries({ queryKey: boardKey })
            const previous = qc.getQueryData<Board>(boardKey)
            if (previous) {
                const next: Board = { planning: [], monitoring: [], controlling: [], reflection: [] }
                for (const s of Object.keys(previous) as Stage[]) {
                    next[s] = previous[s].filter((c) => c.id !== cardId)
                }
                const moved = Object.values(previous)
                    .flat()
                    .find((c) => c.id === cardId)
                if (moved) {
                    next[stage] = [...next[stage], { ...moved, stage, position }].sort(
                        (a, b) => a.position - b.position,
                    )
                }
                qc.setQueryData(boardKey, next)
            }
            return { previous }
        },
        onError: (err, _vars, context) => {
            if (context?.previous) {
                qc.setQueryData(boardKey, context.previous)
            }
            toast.error(err instanceof ApiError ? err.message : "Couldn't move the card — try again")
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: boardKey })
        },
    })
}

export function useArchiveCard() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ cardId, reason }: { cardId: string; reason: string }) =>
            boardApi.archiveCard(cardId, reason),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: boardKey })
            toast.success("Card archived")
        },
        onError: (err) => {
            toast.error(err instanceof ApiError ? err.message : "Failed to archive card")
        },
    })
}

export function useDeleteCard() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: boardApi.deleteCard,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: boardKey })
            toast.success("Card deleted")
        },
        onError: (err) => {
            toast.error(err instanceof ApiError ? err.message : "Failed to delete card")
        },
    })
}

export function useArchivedCards(enabled: boolean) {
    return useQuery({ queryKey: ["cards", "archived"], queryFn: boardApi.listArchivedCards, enabled })
}

export function useRestoreCard() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: boardApi.restoreCard,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: boardKey })
            qc.invalidateQueries({ queryKey: ["cards", "archived"] })
            toast.success("Card restored")
        },
        onError: (err) => {
            toast.error(err instanceof ApiError ? err.message : "Failed to restore card")
        },
    })
}
