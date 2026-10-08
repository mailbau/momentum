import type { User } from "@/types/user"
import { apiFetch, setAccessToken } from "./client"

interface LoginResponse {
    access_token: string
    user: User
}

export async function login(identifier: string, password: string): Promise<User> {
    const res = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: { identifier, password },
    })
    setAccessToken(res.access_token)
    return res.user
}

export interface RegisterInput {
    first_name: string
    last_name: string
    email: string
    username: string
    password: string
}

export async function register(input: RegisterInput): Promise<void> {
    await apiFetch("/api/auth/register", { method: "POST", body: input })
}

export async function logout(): Promise<void> {
    await apiFetch("/api/auth/logout", { method: "POST" })
    setAccessToken(null)
}

export async function fetchMe(): Promise<User> {
    return apiFetch<User>("/api/me")
}

export async function updateMe(input: Omit<User, "id" | "role" | "onboarded">): Promise<User> {
    return apiFetch<User>("/api/me", { method: "PATCH", body: input })
}

export async function updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiFetch("/api/me/password", {
        method: "PUT",
        body: { current_password: currentPassword, new_password: newPassword },
    })
}

export async function markOnboarded(): Promise<void> {
    await apiFetch("/api/me/onboarded", { method: "POST" })
}
