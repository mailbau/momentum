"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/auth-context"

// Real landing page lands in M7. For now, route straight into the app.
export default function Home() {
    const { user, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (loading) return
        if (!user) {
            router.replace("/login")
        } else {
            router.replace(user.role === "admin" ? "/admin" : "/board")
        }
    }, [user, loading, router])

    return (
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
            Loading...
        </div>
    )
}
