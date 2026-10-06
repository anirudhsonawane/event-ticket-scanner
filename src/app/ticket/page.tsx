import QRCodeTicket from "@/components/ticket/QRCodeTicket";
import { tickets } from "@/data/tickets";

export default function TicketPage() {
  return <QRCodeTicket ticket={tickets[0]} />;
}
