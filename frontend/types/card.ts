export type Stage = "planning" | "monitoring" | "controlling" | "reflection"
export type Difficulty = "easy" | "medium" | "hard" | "expert"
export type Priority = "low" | "medium" | "high" | "critical"

export const STAGE_LABELS: Record<Stage, string> = {
    planning: "Planning (To Do)",
    monitoring: "Monitoring (In Progress)",
    controlling: "Controlling (Review)",
    reflection: "Reflection (Done)",
}

export const STAGE_ORDER: Stage[] = ["planning", "monitoring", "controlling", "reflection"]

export interface CardSummary {
    id: string
    course_id: string
    course_code: string
    course_name: string
    strategy_id: string | null
    strategy_name: string | null
    title: string
    description: string
    stage: Stage
    position: number
    difficulty: Difficulty
    priority: Priority
    pre_test: number | null
    post_test: number | null
    rating: number | null
    created_at: string
}

export interface ChecklistItem {
    id: string
    text: string
    done: boolean
    position: number
}

export interface CardLink {
    id: string
    url: string
    label: string
}

export interface CardDetail extends CardSummary {
    prior_knowledge: string
    notes: string
    archived_at: string | null
    archive_reason: string | null
    checklist: ChecklistItem[]
    links: CardLink[]
    study_minutes: number
    timer_running: boolean
}

export type Board = Record<Stage, CardSummary[]>

export interface Course {
    id: string
    code: string
    name: string
}

export interface Strategy {
    id: string
    name: string
    description: string
}

export interface ArchivedCard {
    id: string
    title: string
    archive_reason: string | null
    archived_at: string
}
