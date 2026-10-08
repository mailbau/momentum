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
import * as authApi from "@/lib/api/auth"
import { ApiError } from "@/lib/api/client"

const schema = z.object({
    first_name: z.string().min(1, "Required"),
    last_name: z.string().min(1, "Required"),
    email: z.string().email("Enter a valid email"),
    username: z
        .string()
        .min(3, "At least 3 characters")
        .max(32, "At most 32 characters")
        .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only"),
    password: z
        .string()
        .min(8, "At least 8 characters")
        .regex(/[A-Z]/, "Needs an uppercase letter")
        .regex(/[0-9]/, "Needs a number"),
})

type FormValues = z.infer<typeof schema>

export default function RegisterPage() {
    const router = useRouter()
    const [submitting, setSubmitting] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<FormValues>({ resolver: zodResolver(schema) })

    const onSubmit = async (values: FormValues) => {
        setSubmitting(true)
        try {
            await authApi.register(values)
            toast.success("Account created — sign in to continue")
            router.push("/login")
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Something went wrong")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-2xl">Create your account</CardTitle>
                <CardDescription>Start planning your self-regulated learning</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="first_name">First name</Label>
                            <Input id="first_name" {...register("first_name")} />
                            {errors.first_name && (
                                <p className="text-sm text-destructive">{errors.first_name.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="last_name">Last name</Label>
                            <Input id="last_name" {...register("last_name")} />
                            {errors.last_name && (
                                <p className="text-sm text-destructive">{errors.last_name.message}</p>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" autoComplete="email" {...register("email")} />
                        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input id="username" autoComplete="username" {...register("username")} />
                        {errors.username && (
                            <p className="text-sm text-destructive">{errors.username.message}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            autoComplete="new-password"
                            {...register("password")}
                        />
                        {errors.password && (
                            <p className="text-sm text-destructive">{errors.password.message}</p>
                        )}
                    </div>
                    <Button type="submit" className="w-full" disabled={submitting}>
                        {submitting ? "Creating account..." : "Create account"}
                    </Button>
                </form>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                        Sign in
                    </Link>
                </p>
            </CardContent>
        </Card>
    )
}
