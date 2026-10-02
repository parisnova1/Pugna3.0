import type { ButtonHTMLAttributes } from "react";
import { buttonClass, type ButtonStyle } from "@/components/ui/buttonClass";

export { buttonClass };

export function Button({
  variant,
  size,
  text,
  weight,
  fullWidth,
  className,
  ...props
}: ButtonStyle & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  // No default `type`: existing buttons rely on the native default (submit inside a form).
  return <button {...props} className={buttonClass({ variant, size, text, weight, fullWidth, className })} />;
}
