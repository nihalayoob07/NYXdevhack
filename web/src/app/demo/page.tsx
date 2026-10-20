import { redirect } from "next/navigation";

// The old demo console became the app at /.
export default function DemoPage() {
  redirect("/");
}
