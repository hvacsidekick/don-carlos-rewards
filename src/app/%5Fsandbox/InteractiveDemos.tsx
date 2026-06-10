"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Interactive overlays for visual QA (dialog, sheet, dropdown, toast, tabs). */
export function InteractiveDemos() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Redeem $10 off?</DialogTitle>
              <DialogDescription>
                This spends 100 points. Show the confirmation to staff at checkout.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary">Cancel</Button>
              <Button variant="primary">Redeem</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="secondary">Open sheet</Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Customer found</SheetTitle>
              <SheetDescription>Jane Doe · Balance 70 points</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="More options">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View profile</DropdownMenuItem>
            <DropdownMenuItem>Rotate QR code</DropdownMenuItem>
            <DropdownMenuItem className="text-error focus:text-error">Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="primary" onClick={() => toast.success("Reward ready! 🎉")}>
          Show toast
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="earned">Earned</TabsTrigger>
          <TabsTrigger value="redeemed">Redeemed</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <p className="text-footnote text-fg-secondary">All transactions appear here.</p>
        </TabsContent>
        <TabsContent value="earned">
          <p className="text-footnote text-fg-secondary">Only earned points.</p>
        </TabsContent>
        <TabsContent value="redeemed">
          <p className="text-footnote text-fg-secondary">Only redemptions.</p>
        </TabsContent>
      </Tabs>

      <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
        <div className="flex max-w-sm flex-col gap-1.5">
          <Label htmlFor="demo-email">Email</Label>
          <Input id="demo-email" type="email" placeholder="you@example.com" autoComplete="email" />
          <p className="text-footnote text-fg-secondary">Inputs are 44px+ tall with 17px text.</p>
        </div>

        <div className="flex max-w-sm flex-col gap-1.5">
          <Label htmlFor="demo-error" className="text-error">
            Password
          </Label>
          <Input
            id="demo-error"
            type="password"
            aria-invalid
            defaultValue="short"
            autoComplete="current-password"
            aria-describedby="demo-error-msg"
          />
          <p id="demo-error-msg" role="alert" className="text-footnote font-medium text-error">
            Password must be at least 8 characters.
          </p>
        </div>
      </form>
    </div>
  );
}
