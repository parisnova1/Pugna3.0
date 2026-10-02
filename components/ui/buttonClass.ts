/**
 * The pill button used across the app. Every class combination here already
 * existed hand-rolled in the codebase; this table only names them, so adopting
 * it never changes how a button looks.
 *
 * Variant, vertical size, text size and weight are independent because the
 * existing buttons mix them freely (e.g. a `py-3` button with and without
 * `text-sm`, or the medium-weight Follow buttons).
 * Horizontal padding and layout (`px-5`, `inline-block`, `flex-1`,
 * `shrink-0`...) stay with the caller via `className`.
 */
export type ButtonVariant = "primary" | "outline" | "signalOutline" | "danger" | "dangerOutline" | "success";
export type ButtonSize = "lg" | "md" | "sm" | "xs" | "xxs";
export type ButtonText = "sm" | "xs";
export type ButtonWeight = "semibold" | "medium" | "bold";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-signal text-onsignal",
  outline: "border border-white/20 text-ink",
  signalOutline: "border border-signal text-signal",
  danger: "bg-error text-ink",
  dangerOutline: "border border-error/40 text-error",
  success: "border border-success bg-success text-onsignal",
};

const SIZE: Record<ButtonSize, string> = {
  lg: "py-3.5",
  md: "py-3",
  sm: "py-2.5",
  xs: "py-2",
  xxs: "py-1.5",
};

const WEIGHT: Record<ButtonWeight, string> = {
  semibold: "font-semibold",
  medium: "font-medium",
  bold: "font-bold",
};

const TEXT: Record<ButtonText, string> = {
  sm: "text-sm",
  xs: "text-xs",
};

export type ButtonStyle = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  text?: ButtonText;
  weight?: ButtonWeight;
  fullWidth?: boolean;
  className?: string;
};

/** Class string for anything that must look like a Button but isn't a <button> (e.g. a next/link <Link>). */
export function buttonClass({ variant = "primary", size = "md", text, weight = "semibold", fullWidth, className }: ButtonStyle = {}): string {
  return [
    "rounded-pill",
    VARIANT[variant],
    SIZE[size],
    text ? TEXT[text] : "",
    WEIGHT[weight],
    fullWidth ? "w-full" : "",
    "disabled:opacity-60",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}
