"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import type { User } from "@/types/user"
import * as authApi from "@/lib/api/auth"

interface AuthContextValue {
    user: User | null
    /** True while the initial session bootstrap (silent refresh) is running. */
    loading: boolean
    login: (identifier: string, password: string) => Promise<User>
    logout: () => Promise<void>
    refetch: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    const refetch = useCallback(async () => {
        try {
            const me = await authApi.fetchMe()
            setUser(me)
        } catch {
            setUser(null)
        }
    }, [])

    // On first mount there's no access token in memory yet. fetchMe() will
    // 401, which triggers client.ts's built-in refresh-and-retry using the
    // httpOnly cookie — this is what keeps the user signed in across reloads.
    useEffect(() => {
        refetch().finally(() => setLoading(false))
    }, [refetch])

    const login = useCallback(async (identifier: string, password: string) => {
        const me = await authApi.login(identifier, password)
        setUser(me)
        return me
    }, [])

    const logout = useCallback(async () => {
        await authApi.logout()
        setUser(null)
    }, [])

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, refetch }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error("useAuth must be used within AuthProvider")
    return ctx
}
