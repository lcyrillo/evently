export interface Event {
  id: number;
  title: string;
  description: string;
  date: string;
  location: string;
  price: number;
  total_tickets: number;
  tickets_sold: number;
  image_url: string;
}

export interface Ticket {
  id: number;
  event_id: number;
  buyer_name: string;
  buyer_email: string;
  purchase_date: string;
}

export interface User {
  id: number;
  email: string;
  role: 'admin' | 'user';
}

export interface MyTicket extends Ticket {
  event_title: string;
  event_date: string;
  event_location: string;
  event_image: string;
}
