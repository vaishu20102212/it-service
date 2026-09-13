import api from "./api";
import type { Ticket } from "../types/ticket";
import { getStoredTickets, setStoredTickets } from "./mockData";

export const getTickets = async (): Promise<Ticket[]> => {
  try {
    const response = await api.get<Ticket[]>("/tickets");
    if (response.data && response.data.length > 0) {
      // Merge instead of overwrite: keep any locally-created tickets
      // that haven't made it to the server yet (e.g. backend was
      // asleep/unreachable when they were created), so they don't
      // silently disappear once the server responds.
      const localTickets = getStoredTickets();
      const serverIds = new Set(response.data.map((t) => t.id));
      const localOnly = localTickets.filter((t) => !serverIds.has(t.id));
      const merged = [...localOnly, ...response.data];

      setStoredTickets(merged);
      return merged;
    }
  } catch {
    // fallback to local storage
  }
  return getStoredTickets();
};

export const getTicketById = async (id: string): Promise<Ticket> => {
  try {
    const response = await api.get<Ticket>(`/tickets/${id}`);
    return response.data;
  } catch {
    const tickets = getStoredTickets();
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket) throw new Error("Ticket not found");
    return ticket;
  }
};

export const createTicket = async (ticket: Ticket): Promise<Ticket> => {
  const tickets = getStoredTickets();
  const updatedTickets = [ticket, ...tickets];
  setStoredTickets(updatedTickets);

  try {
    const response = await api.post<Ticket>("/tickets", ticket);
    return response.data;
  } catch {
    return ticket;
  }
};

export const updateTicket = async (
  id: string,
  ticketUpdate: Partial<Ticket>
): Promise<Ticket> => {
  const tickets = getStoredTickets();
  const index = tickets.findIndex((t) => t.id === id);
  let updatedTicket: Ticket;
  if (index !== -1) {
    updatedTicket = { ...tickets[index], ...ticketUpdate };
    tickets[index] = updatedTicket;
    setStoredTickets(tickets);
  } else {
    throw new Error("Ticket not found");
  }

  try {
    const response = await api.patch<Ticket>(`/tickets/${id}`, ticketUpdate);
    return response.data;
  } catch {
    return updatedTicket;
  }
};

export const deleteTicket = async (id: string): Promise<void> => {
  const tickets = getStoredTickets();
  const updated = tickets.filter((t) => t.id !== id);
  setStoredTickets(updated);

  try {
    await api.delete(`/tickets/${id}`);
  } catch {
    // handled locally
  }
};