"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth/auth-context"
import { ApiError } from "@/lib/api/client"

const schema = z.object({
    identifier: z.string().min(1, "Enter your email or username"),
    password: z.string().min(1, "Enter your password"),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
    const router = useRouter()
    const { login } = useAuth()
    const [submitting, setSubmitting] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<FormValues>({ resolver: zodResolver(schema) })

    const onSubmit = async (values: FormValues) => {
        setSubmitting(true)
        try {
            const user = await login(values.identifier, values.password)
            router.push(user.role === "admin" ? "/admin" : "/board")
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Something went wrong")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-2xl">Welcome back</CardTitle>
                <CardDescription>Sign in to continue to your board</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="identifier">Email or username</Label>
                        <Input id="identifier" autoComplete="username" {...register("identifier")} />
                        {errors.identifier && (
                            <p className="text-sm text-destructive">{errors.identifier.message}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            {...register("password")}
                        />
                        {errors.password && (
                            <p className="text-sm text-destructive">{errors.password.message}</p>
                        )}
                    </div>
                    <Button type="submit" className="w-full" disabled={submitting}>
                        {submitting ? "Signing in..." : "Sign in"}
                    </Button>
                </form>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                    Don&apos;t have an account?{" "}
                    <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
                        Register
                    </Link>
                </p>
            </CardContent>
        </Card>
    )
}
