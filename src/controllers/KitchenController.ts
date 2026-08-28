import { KitchenRepository } from '../domain/repositories/KitchenRepository';
import {
  KitchenTicket,
  KitchenStation,
  KitchenPrepStatus,
  KitchenOrderPriority,
  KitchenWasteLog,
  KitchenStationType
} from '../domain/entities/kitchen';

export class KitchenController {
  private repository: KitchenRepository;

  constructor(repository: KitchenRepository) {
    this.repository = repository;
  }

  public subscribeTickets(callback: (tickets: KitchenTicket[]) => void, branchId?: string, isHQ?: boolean, onError?: (err: Error) => void): () => void {
    return this.repository.subscribeKitchenTickets(callback, branchId, isHQ, onError);
  }

  public subscribeStations(callback: (stations: KitchenStation[]) => void, onError?: (err: Error) => void): () => void {
    return this.repository.subscribeKitchenStations(callback, onError);
  }

  public async advanceTicketStatus(ticketId: string, currentStatus: KitchenPrepStatus): Promise<KitchenPrepStatus> {
    let nextStatus: KitchenPrepStatus = 'new';
    
    if (currentStatus === 'new') {
      nextStatus = 'accepted';
    } else if (currentStatus === 'accepted') {
      nextStatus = 'cooking';
    } else if (currentStatus === 'cooking') {
      nextStatus = 'ready_for_pickup';
    } else if (currentStatus === 'ready_for_pickup') {
      nextStatus = 'completed';
    } else {
      nextStatus = currentStatus;
    }

    await this.repository.updateTicketStatus(ticketId, nextStatus);
    return nextStatus;
  }

  public async setTicketStatus(ticketId: string, status: KitchenPrepStatus): Promise<void> {
    await this.repository.updateTicketStatus(ticketId, status);
  }

  public async updateTicketStatus(ticketId: string, status: KitchenPrepStatus): Promise<void> {
    await this.repository.updateTicketStatus(ticketId, status);
  }

  public async setTicketPriority(ticketId: string, priority: KitchenOrderPriority): Promise<void> {
    await this.repository.updateTicketPriority(ticketId, priority);
  }

  public async setItemStatus(ticketId: string, productId: string, itemStatus: KitchenPrepStatus): Promise<void> {
    await this.repository.updateItemStatusInTicket(ticketId, productId, itemStatus);
  }

  public async setStationStatus(stationId: string, status: 'normal' | 'busy' | 'overloaded', chefName?: string): Promise<void> {
    await this.repository.updateStationStatus(stationId, status, chefName);
  }

  public async logWaste(wasteData: {
    orderId?: string;
    itemName: string;
    quantity: number;
    unit: string;
    reason: string;
    cost: number;
    loggedBy: string;
  }): Promise<string> {
    if (!wasteData.itemName || wasteData.quantity <= 0) {
      throw new Error('Please specify item name and positive quantity for waste logging.');
    }

    return await this.repository.logKitchenWaste({
      orderId: wasteData.orderId,
      itemOrIngredientName: wasteData.itemName,
      quantity: wasteData.quantity,
      unit: wasteData.unit || 'units',
      reason: wasteData.reason || 'Expired / Damaged in Kitchen',
      cost: wasteData.cost || 0,
      loggedBy: wasteData.loggedBy || 'Kitchen Staff'
    });
  }

  public async getWasteLogs(): Promise<KitchenWasteLog[]> {
    return await this.repository.fetchKitchenWasteLogs();
  }
}
