"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as boardApi from "@/lib/api/board"
import type { UpdateCardInput } from "@/lib/api/board"
import { ApiError } from "@/lib/api/client"
import { boardKey } from "./use-board"

const detailKey = (id: string) => ["card", id] as const

export function useCardDetail(id: string | null) {
    return useQuery({
        queryKey: detailKey(id ?? ""),
        queryFn: () => boardApi.getCard(id as string),
        enabled: !!id,
    })
}

function useInvalidateCard(id: string) {
    const qc = useQueryClient()
    return () => {
        qc.invalidateQueries({ queryKey: detailKey(id) })
        qc.invalidateQueries({ queryKey: boardKey })
    }
}

export function useUpdateCard(id: string) {
    const invalidate = useInvalidateCard(id)
    return useMutation({
        mutationFn: (input: UpdateCardInput) => boardApi.updateCard(id, input),
        onSuccess: invalidate,
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Couldn't save that change"),
    })
}

export function useChecklistMutations(cardId: string) {
    const invalidate = useInvalidateCard(cardId)
    const add = useMutation({
        mutationFn: (text: string) => boardApi.addChecklistItem(cardId, text),
        onSuccess: invalidate,
    })
    const update = useMutation({
        mutationFn: ({ itemId, text, done }: { itemId: string; text: string; done: boolean }) =>
            boardApi.updateChecklistItem(cardId, itemId, text, done),
        onSuccess: invalidate,
    })
    const remove = useMutation({
        mutationFn: (itemId: string) => boardApi.deleteChecklistItem(cardId, itemId),
        onSuccess: invalidate,
    })
    return { add, update, remove }
}

export function useLinkMutations(cardId: string) {
    const invalidate = useInvalidateCard(cardId)
    const add = useMutation({
        mutationFn: ({ url, label }: { url: string; label: string }) => boardApi.addLink(cardId, url, label),
        onSuccess: invalidate,
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Couldn't add that link"),
    })
    const remove = useMutation({
        mutationFn: (linkId: string) => boardApi.deleteLink(cardId, linkId),
        onSuccess: invalidate,
    })
    return { add, remove }
}

export function useTimer(cardId: string) {
    const invalidate = useInvalidateCard(cardId)
    const start = useMutation({
        mutationFn: () => boardApi.startSession(cardId),
        onSuccess: invalidate,
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Couldn't start the timer"),
    })
    const stop = useMutation({
        mutationFn: () => boardApi.stopSession(),
        onSuccess: invalidate,
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Couldn't stop the timer"),
    })
    return { start, stop }
}
