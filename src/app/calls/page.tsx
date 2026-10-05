import { Suspense } from "react";
import CallsView from "@/components/CallsView";

export const metadata = { title: "Calls · Maxdots" };

export default function Page() {
  return (
    <Suspense>
      <CallsView />
    </Suspense>
  );
}
