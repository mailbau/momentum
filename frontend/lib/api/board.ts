import { apiFetch } from "./client"
import type { Board, CardDetail, Course, Strategy, ArchivedCard, Stage, Difficulty, Priority } from "@/types/card"

export function getBoard(): Promise<Board> {
    return apiFetch<Board>("/api/board")
}

export function getCourses(): Promise<Course[]> {
    return apiFetch<Course[]>("/api/courses")
}

export function getStrategies(): Promise<Strategy[]> {
    return apiFetch<Strategy[]>("/api/strategies")
}

export function createCard(input: { course_id: string; title: string }): Promise<{ id: string }> {
    return apiFetch("/api/cards", { method: "POST", body: input })
}

export function getCard(id: string): Promise<CardDetail> {
    return apiFetch<CardDetail>(`/api/cards/${id}`)
}

export interface UpdateCardInput {
    description?: string
    strategy_id?: string | null
    difficulty?: Difficulty
    priority?: Priority
    pre_test?: number | null
    post_test?: number | null
    prior_knowledge?: string
    notes?: string
    rating?: number | null
}

export function updateCard(id: string, input: UpdateCardInput): Promise<CardDetail> {
    return apiFetch<CardDetail>(`/api/cards/${id}`, { method: "PATCH", body: input })
}

export function moveCard(id: string, stage: Stage, position: number): Promise<{ id: string; stage: Stage }> {
    return apiFetch(`/api/cards/${id}/move`, { method: "PATCH", body: { stage, position } })
}

export function archiveCard(id: string, reason: string): Promise<void> {
    return apiFetch(`/api/cards/${id}/archive`, { method: "POST", body: { reason } })
}

export function restoreCard(id: string): Promise<void> {
    return apiFetch(`/api/cards/${id}/restore`, { method: "POST" })
}

export function deleteCard(id: string): Promise<void> {
    return apiFetch(`/api/cards/${id}`, { method: "DELETE" })
}

export function listArchivedCards(): Promise<ArchivedCard[]> {
    return apiFetch<ArchivedCard[]>("/api/cards/archived")
}

export function addChecklistItem(cardId: string, text: string) {
    return apiFetch(`/api/cards/${cardId}/checklist`, { method: "POST", body: { text } })
}

export function updateChecklistItem(cardId: string, itemId: string, text: string, done: boolean) {
    return apiFetch(`/api/cards/${cardId}/checklist/${itemId}`, { method: "PATCH", body: { text, done } })
}

export function deleteChecklistItem(cardId: string, itemId: string) {
    return apiFetch(`/api/cards/${cardId}/checklist/${itemId}`, { method: "DELETE" })
}

export function addLink(cardId: string, url: string, label: string) {
    return apiFetch(`/api/cards/${cardId}/links`, { method: "POST", body: { url, label } })
}

export function deleteLink(cardId: string, linkId: string) {
    return apiFetch(`/api/cards/${cardId}/links/${linkId}`, { method: "DELETE" })
}

export function startSession(cardId: string) {
    return apiFetch(`/api/cards/${cardId}/sessions/start`, { method: "POST" })
}

export function stopSession() {
    return apiFetch("/api/sessions/stop", { method: "POST" })
}

export function getActiveSession(): Promise<{ active: boolean; card_id?: string; started_at?: string }> {
    return apiFetch("/api/sessions/active")
}
