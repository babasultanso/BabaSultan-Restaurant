import {
  KitchenTicket,
  KitchenStation,
  KitchenPrepStatus,
  KitchenOrderPriority,
  KitchenWasteLog
} from '../entities/kitchen';

export interface KitchenRepository {
  subscribeKitchenTickets(callback: (tickets: KitchenTicket[]) => void, branchId?: string, isHQ?: boolean, onError?: (err: Error) => void): () => void;
  subscribeKitchenStations(callback: (stations: KitchenStation[]) => void, onError?: (err: Error) => void): () => void;
  getKitchenTickets(branchId?: string, isHQ?: boolean): Promise<KitchenTicket[]>;
  getKitchenStations(): Promise<KitchenStation[]>;
  updateTicketStatus(ticketId: string, status: KitchenPrepStatus): Promise<void>;
  updateTicketPriority(ticketId: string, priority: KitchenOrderPriority): Promise<void>;
  updateItemStatusInTicket(ticketId: string, productId: string, itemStatus: KitchenPrepStatus): Promise<void>;
  updateStationStatus(stationId: string, status: 'normal' | 'busy' | 'overloaded', chefName?: string): Promise<void>;
  createKitchenTicketFromOrder(order: any): Promise<KitchenTicket>;
  logKitchenWaste(waste: Omit<KitchenWasteLog, 'id' | 'createdAt'>): Promise<string>;
  fetchKitchenWasteLogs(): Promise<KitchenWasteLog[]>;
}
