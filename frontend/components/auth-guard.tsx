"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/auth-context"
import type { Role } from "@/types/user"

/** Redirects to /login if signed out, or to /board if the role doesn't match. */
export function AuthGuard({ role, children }: { role: Role; children: ReactNode }) {
    const { user, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (loading) return
        if (!user) {
            router.replace("/login")
        } else if (user.role !== role) {
            router.replace("/board")
        }
    }, [loading, user, role, router])

    if (loading || !user || user.role !== role) {
        return (
            <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
                Loading...
            </div>
        )
    }

    return <>{children}</>
}
