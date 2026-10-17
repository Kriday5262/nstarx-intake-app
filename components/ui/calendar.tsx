"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, UI, DayFlag, SelectionState } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        [UI.Root]: "w-fit",
        [UI.Months]: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        [UI.Month]: "space-y-4",
        [UI.MonthCaption]: "flex justify-center pt-1 relative items-center",
        [UI.CaptionLabel]: "text-sm font-medium",
        [UI.Nav]: "space-x-1 flex items-center",
        [UI.PreviousMonthButton]: cn(
          buttonVariants({ variant: "outline" }),
          "h-9 w-9 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1"
        ),
        [UI.NextMonthButton]: cn(
          buttonVariants({ variant: "outline" }),
          "h-9 w-9 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1"
        ),
        [UI.MonthGrid]: "w-full border-collapse space-y-1",
        [UI.Weekdays]: "flex",
        [UI.Weekday]:
          "text-muted-foreground rounded-md w-11 font-normal text-[0.8rem]",
        [UI.Week]: "flex w-full mt-2",
        [UI.Day]: "text-center text-sm p-0 relative",
        [UI.DayButton]: cn(
          buttonVariants({ variant: "ghost" }),
          "h-11 w-11 p-0 font-normal aria-selected:opacity-100"
        ),
        [DayFlag.outside]: "text-muted-foreground opacity-50",
        [DayFlag.disabled]: "text-muted-foreground opacity-50",
        [DayFlag.today]: "bg-accent text-accent-foreground",
        [SelectionState.selected]:
          "bg-brand-purple text-white hover:bg-brand-purple hover:text-white focus:bg-brand-purple focus:text-white",
        [UI.WeekNumber]: "text-muted-foreground opacity-50",
        ...classNames,
      }}
      components={{
        Chevron: (props: {
          className?: string;
          style?: React.CSSProperties;
          size?: number;
          disabled?: boolean;
          orientation?: "up" | "down" | "left" | "right";
        }) => {
          const { className, style, orientation } = props;
          if (orientation === "left") return <ChevronLeft className={cn("h-4 w-4", className)} style={style} />;
          if (orientation === "right") return <ChevronRight className={cn("h-4 w-4", className)} style={style} />;
          return <span />;
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
