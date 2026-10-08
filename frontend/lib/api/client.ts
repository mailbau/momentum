const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// Access token lives in memory only (never localStorage) so it can't be
// read by an XSS payload. It's rehydrated on app load via the httpOnly
// refresh cookie (see AuthContext's bootstrap effect).
let accessToken: string | null = null

export function getAccessToken() {
    return accessToken
}

export function setAccessToken(token: string | null) {
    accessToken = token
}

export class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
        super(message)
        this.status = status
    }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
    body?: unknown
    /** Skip the automatic refresh-and-retry on 401 (used by the refresh call itself). */
    skipAuthRetry?: boolean
}

async function doFetch(path: string, options: RequestOptions): Promise<Response> {
    const headers = new Headers(options.headers)
    headers.set("Content-Type", "application/json")
    if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`)
    }

    return fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        credentials: "include",
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
}

/** Core request helper used by every endpoint module under lib/api/. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
    let res = await doFetch(path, options)

    if (res.status === 401 && !options.skipAuthRetry && path !== "/api/auth/refresh") {
        const refreshed = await tryRefresh()
        if (refreshed) {
            res = await doFetch(path, options)
        }
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new ApiError(res.status, body.message ?? `Request failed with status ${res.status}`)
    }

    if (res.status === 204) {
        return undefined as T
    }
    return res.json() as Promise<T>
}

let refreshPromise: Promise<boolean> | null = null

/** Deduplicates concurrent refresh attempts into a single in-flight request. */
async function tryRefresh(): Promise<boolean> {
    if (!refreshPromise) {
        refreshPromise = doFetch("/api/auth/refresh", { method: "POST", skipAuthRetry: true })
            .then(async (res) => {
                if (!res.ok) {
                    setAccessToken(null)
                    return false
                }
                const data = await res.json()
                setAccessToken(data.access_token)
                return true
            })
            .catch(() => {
                setAccessToken(null)
                return false
            })
            .finally(() => {
                refreshPromise = null
            })
    }
    return refreshPromise
}
