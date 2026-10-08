"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth/auth-context"

export default function AdminPage() {
    const { user, logout } = useAuth()

    return (
        <div className="p-8">
            <h1 className="text-2xl font-semibold">Admin — {user?.first_name}</h1>
            <p className="text-muted-foreground">Courses, strategies, and user management land here in M5.</p>
            <Button variant="outline" className="mt-4" onClick={() => logout()}>
                Sign out
            </Button>
        </div>
    )
}
