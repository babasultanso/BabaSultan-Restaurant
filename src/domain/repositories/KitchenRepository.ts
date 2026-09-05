import {
  KitchenTicket,
  KitchenStation,
  KitchenPrepStatus,
  KitchenOrderPriority,
  KitchenWasteLog
} from '../entities/kitchen';

export interface KitchenRepository {
  subscribeKitchenTickets(
    callback: (tickets: KitchenTicket[]) => void,
    branchId?: string,
    isHQ?: boolean,
    onError?: (err: Error) => void,
    onNewTickets?: (newTickets: KitchenTicket[]) => void
  ): () => void;
  subscribeKitchenStations(
    callback: (stations: KitchenStation[]) => void,
    branchId?: string,
    isHQ?: boolean,
    onError?: (err: Error) => void
  ): () => void;
  getKitchenTickets(branchId?: string, isHQ?: boolean): Promise<KitchenTicket[]>;
  getKitchenStations(branchId?: string, isHQ?: boolean): Promise<KitchenStation[]>;
  updateTicketStatus(ticketId: string, status: KitchenPrepStatus): Promise<void>;
  updateTicketPriority(ticketId: string, priority: KitchenOrderPriority): Promise<void>;
  updateItemStatusInTicket(ticketId: string, productId: string, itemStatus: KitchenPrepStatus): Promise<void>;
  updateStationStatus(stationId: string, status: 'normal' | 'busy' | 'overloaded', chefName?: string): Promise<void>;
  createKitchenTicketFromOrder(order: any): Promise<KitchenTicket>;
  logKitchenWaste(waste: Omit<KitchenWasteLog, 'id' | 'createdAt'>): Promise<string>;
  fetchKitchenWasteLogs(): Promise<KitchenWasteLog[]>;
}
