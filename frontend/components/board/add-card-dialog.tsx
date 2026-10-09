"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCourses, useCreateCard } from "@/hooks/use-board"

export function AddCardDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { data: courses, isLoading: coursesLoading } = useCourses()
    const createCard = useCreateCard()
    const [courseId, setCourseId] = useState<string>("")
    const [title, setTitle] = useState("")

    const reset = () => {
        setCourseId("")
        setTitle("")
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!courseId || !title.trim()) return
        createCard.mutate(
            { course_id: courseId, title: title.trim() },
            {
                onSuccess: () => {
                    reset()
                    onOpenChange(false)
                },
            },
        )
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
            <DialogContent>
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Plan a new task</DialogTitle>
                        <DialogDescription>
                            It starts in Planning — drag it to Monitoring once you begin studying.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="course">Course</Label>
                            <Select value={courseId} onValueChange={(v) => setCourseId(v ?? "")} disabled={coursesLoading}>
                                <SelectTrigger id="course" className="w-full">
                                    <SelectValue placeholder="Select a course" />
                                </SelectTrigger>
                                <SelectContent>
                                    {courses?.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.code} — {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="title">What are you studying?</Label>
                            <Input
                                id="title"
                                placeholder="e.g. Encapsulation"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={!courseId || !title.trim() || createCard.isPending}
                        >
                            {createCard.isPending ? "Adding..." : "Add task"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
