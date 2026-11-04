import { CircleAlert, Info } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ThemeSlider } from "@/components/theme-slider"

export function App() {
  // the slider themes only the #demo-block below (applyThemeToRoot(theme, element)), not <html>
  return (
    <div id="demo-block" className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>gennex-color</CardTitle>
          <CardDescription>shadcn components themed by the exported CSS.</CardDescription>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ThemeSlider />
          <Alert>
            <Info />
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>You can switch preset by changing one import.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>Check the highlighted field and try again.</AlertDescription>
          </Alert>
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input id="name" placeholder="Ada Lovelace" />
            <FieldDescription>Shown on your profile.</FieldDescription>
          </Field>
          <Field data-invalid="true">
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" aria-invalid defaultValue="not-an-email" />
            <FieldError>Enter a valid email address.</FieldError>
          </Field>
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="destructive">Delete</Button>
          <Button variant="link">Link</Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default App
