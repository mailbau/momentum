"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth/auth-context"

export default function BoardPage() {
    const { user, logout } = useAuth()

    return (
        <div className="p-8">
            <h1 className="text-2xl font-semibold">Welcome, {user?.first_name}</h1>
            <p className="text-muted-foreground">The Kanban board lands here in M2.</p>
            <Button variant="outline" className="mt-4" onClick={() => logout()}>
                Sign out
            </Button>
        </div>
    )
}
