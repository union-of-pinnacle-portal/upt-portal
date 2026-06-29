import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Hello, world 👋</CardTitle>
          <CardDescription>
            A Next.js app styled with Tailwind CSS and shadcn/ui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Edit <code className="font-mono">src/app/page.tsx</code> to start
            building your frontend.
          </p>
        </CardContent>
        <CardFooter className="gap-2">
          <Button>Get started</Button>
          <Button variant="outline">Learn more</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
