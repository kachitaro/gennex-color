import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function App() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>gennex-color</CardTitle>
          <CardDescription>shadcn Card, Input and Button themed by the exported CSS.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input placeholder="Email" type="email" />
          <Input placeholder="Disabled" disabled />
        </CardContent>
        <CardFooter className="gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="destructive">Delete</Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default App
