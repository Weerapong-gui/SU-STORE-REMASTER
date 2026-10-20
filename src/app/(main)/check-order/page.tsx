import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { TrackOrder } from "@/components/store/TrackOrder";

export default function CheckOrderPage() {
  return (
    <Container className="py-12 md:py-16">
      <Suspense>
        <TrackOrder />
      </Suspense>
    </Container>
  );
}
