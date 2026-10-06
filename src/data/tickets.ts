export type Ticket = {
  ticketId: string;
  eventName: string;
  eventSubtitle: string;
  ticketType: string;
  customerName: string;
  mobile: string;
  date: string;
  venue: string;
};

export const tickets: Ticket[] = [
  {
    ticketId: "ND2026-000123",
    eventName: "NAV DURGA",
    eventSubtitle: "RAAS DANDIYA 2026",
    ticketType: "GENERAL ACCESS",
    customerName: "Rahul Sharma",
    mobile: "9876543210",
    date: "10 OCT 2026",
    venue: "GURUKUL OLYMPIAD SCHOOL",
  },
  {
    ticketId: "ND2026-000124",
    eventName: "NAV DURGA",
    eventSubtitle: "RAAS DANDIYA 2026",
    ticketType: "VIP",
    customerName: "Priya Shah",
    mobile: "9876543211",
    date: "10 OCT 2026",
    venue: "GURUKUL OLYMPIAD SCHOOL",
  },
];
