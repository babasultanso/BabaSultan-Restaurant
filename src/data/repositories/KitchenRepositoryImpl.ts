import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  where
} from 'firebase/firestore';
import { db, COLLECTIONS, deductProductIngredientsStockFirestore, updateKitchenStatusFirestore, updateKitchenTicketFirestore, recordInventoryMovementFirestore, getAuthToken } from '../../lib/firebase';
import { getApiUrl } from '../../lib/apiConfig';
import {
  KitchenTicket,
  KitchenStation,
  KitchenPrepStatus,
  KitchenOrderPriority,
  KitchenWasteLog,
  KitchenStationType,
  KitchenOrderItem
} from '../../domain/entities/kitchen';
import { KitchenRepository } from '../../domain/repositories/KitchenRepository';

export function routeProductToStation(productName: string, category?: string): KitchenStationType {
  const combined = `${productName} ${category || ''}`.toLowerCase();
  
  if (
    combined.includes('pizza') ||
    combined.includes('bakery') ||
    combined.includes('pie') ||
    combined.includes('pastry') ||
    combined.includes('canjeero') ||
    combined.includes('sambusa') ||
    combined.includes('samosa')
  ) {
    return 'pizza';
  }

  if (
    combined.includes('tea') ||
    combined.includes('shaah') ||
    combined.includes('juice') ||
    combined.includes('coffee') ||
    combined.includes('drink') ||
    combined.includes('soda') ||
    combined.includes('water') ||
    combined.includes('beverage') ||
    combined.includes('milk')
  ) {
    return 'drinks';
  }

  if (
    combined.includes('dessert') ||
    combined.includes('cake') ||
    combined.includes('ice cream') ||
    combined.includes('halwa') ||
    combined.includes('sweet') ||
    combined.includes('pancake') ||
    combined.includes('crepe')
  ) {
    return 'dessert';
  }

  if (
    combined.includes('grill') ||
    combined.includes('suqaar') ||
    combined.includes('camel') ||
    combined.includes('mandi') ||
    combined.includes('lamb') ||
    combined.includes('chicken') ||
    combined.includes('steak') ||
    combined.includes('meat') ||
    combined.includes('kebab') ||
    combined.includes('bbq') ||
    combined.includes('bariis') ||
    combined.includes('rice')
  ) {
    return 'grill';
  }

  return 'packing';
}

export class KitchenRepositoryImpl implements KitchenRepository {

  subscribeKitchenTickets(callback: (tickets: KitchenTicket[]) => void, branchId?: string, isHQ?: boolean, onError?: (err: Error) => void): () => void {
    const isBranchScoped = !isHQ && branchId && branchId !== 'all';
    const q = isBranchScoped
      ? query(collection(db, COLLECTIONS.KITCHEN_ORDERS), where('branchId', '==', branchId))
      : query(collection(db, COLLECTIONS.KITCHEN_ORDERS), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      try {
        const tickets: KitchenTicket[] = snap.docs.map(d => {
          const data = d.data();
          const createdTimestamp = data.createdAt || data.orderTime || new Date().toISOString();
          return {
            id: d.id,
            orderId: data.orderId || d.id,
            orderNumber: data.orderNumber || `ORD-${d.id.slice(0, 5)}`,
            orderTime: data.orderTime || createdTimestamp,
            createdAt: createdTimestamp,
            updatedAt: data.updatedAt || createdTimestamp,
            orderType: data.orderType || 'dine_in',
            tableNumber: data.tableNumber || '',
            customerName: data.customerName || 'Walk-in Guest',
            branchId: data.branchId,
            items: data.items || [],
            prepStatus: (data.prepStatus || 'new') as KitchenPrepStatus,
            priority: (data.priority || 'normal') as KitchenOrderPriority,
            estimatedPrepTimeMinutes: data.estimatedPrepTimeMinutes || 15,
            notes: data.notes || '',
            ...data
          } as KitchenTicket;
        });

        // Ensure robust sorting by descending creation time
        tickets.sort((a, b) => new Date(b.createdAt || b.orderTime || 0).getTime() - new Date(a.createdAt || a.orderTime || 0).getTime());
        callback(tickets);
      } catch (err: any) {
        console.error('Error handling kitchen tickets snapshot:', err);
        if (onError) onError(err instanceof Error ? err : new Error(String(err)));
      }
    }, (err) => {
      console.error('Kitchen tickets snapshot listener error:', err);
      if (onError) onError(err instanceof Error ? err : new Error(String(err)));
    });

    return unsubscribe;
  }

  subscribeKitchenStations(callback: (stations: KitchenStation[]) => void, onError?: (err: Error) => void): () => void {
    const q = query(collection(db, COLLECTIONS.STATIONS));
    return onSnapshot(q, (snap) => {
      const stations: KitchenStation[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as KitchenStation));
      callback(stations);
    }, (err) => {
      console.error('Kitchen stations snapshot error:', err);
      if (onError) onError(err instanceof Error ? err : new Error(String(err)));
    });
  }

  async getKitchenTickets(branchId?: string, isHQ?: boolean): Promise<KitchenTicket[]> {
    const isBranchScoped = !isHQ && branchId && branchId !== 'all';
    const q = isBranchScoped
      ? query(collection(db, COLLECTIONS.KITCHEN_ORDERS), where('branchId', '==', branchId))
      : query(collection(db, COLLECTIONS.KITCHEN_ORDERS), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const tickets = snap.docs.map(d => {
      const data = d.data();
      const createdTimestamp = data.createdAt || data.orderTime || new Date().toISOString();
      return {
        id: d.id,
        orderId: data.orderId || d.id,
        orderNumber: data.orderNumber || `ORD-${d.id.slice(0, 5)}`,
        orderTime: data.orderTime || createdTimestamp,
        createdAt: createdTimestamp,
        updatedAt: data.updatedAt || createdTimestamp,
        orderType: data.orderType || 'dine_in',
        tableNumber: data.tableNumber || '',
        customerName: data.customerName || 'Walk-in Guest',
        branchId: data.branchId,
        items: data.items || [],
        prepStatus: (data.prepStatus || 'new') as KitchenPrepStatus,
        priority: (data.priority || 'normal') as KitchenOrderPriority,
        estimatedPrepTimeMinutes: data.estimatedPrepTimeMinutes || 15,
        notes: data.notes || '',
        ...data
      } as KitchenTicket;
    });

    tickets.sort((a, b) => new Date(b.createdAt || b.orderTime || 0).getTime() - new Date(a.createdAt || a.orderTime || 0).getTime());
    return tickets;
  }

  async getKitchenStations(): Promise<KitchenStation[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.STATIONS));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as KitchenStation));
  }

  async updateTicketStatus(ticketId: string, status: KitchenPrepStatus): Promise<void> {
    await updateKitchenStatusFirestore(ticketId, status);
  }

  async updateTicketPriority(ticketId: string, priority: KitchenOrderPriority): Promise<void> {
    await updateKitchenTicketFirestore(ticketId, { priority });
  }

  async updateItemStatusInTicket(ticketId: string, productId: string, itemStatus: KitchenPrepStatus): Promise<void> {
    const ticketRef = doc(db, COLLECTIONS.KITCHEN_ORDERS, ticketId);
    const docSnap = await getDoc(ticketRef);
    if (!docSnap.exists()) {
      throw new Error(`Kitchen ticket #${ticketId} not found.`);
    }

    const ticket = docSnap.data() as KitchenTicket;
    const currentStatus = (ticket.prepStatus || 'new') as KitchenPrepStatus;

    if (currentStatus === 'new' && itemStatus !== 'new') {
      throw new Error('Cannot start cooking or advance item status while ticket is in "new" (pending acceptance) status. Please accept the order first.');
    }

    const updatedItems = (ticket.items || []).map(item => {
      if (item.productId === productId) {
        return { ...item, itemStatus };
      }
      return item;
    });

    const allReady = updatedItems.length > 0 && updatedItems.every(i => i.itemStatus === 'ready_for_pickup' || i.itemStatus === 'completed');
    const anyCookingOrReady = updatedItems.some(i => i.itemStatus === 'cooking' || i.itemStatus === 'ready_for_pickup' || i.itemStatus === 'completed');

    let newPrepStatus: KitchenPrepStatus = currentStatus;

    // Authoritative State Machine Progression:
    // Valid lifecycle: new -> accepted -> cooking -> ready_for_pickup -> completed
    // - If current is 'new': ticket MUST remain 'new' (cannot jump to cooking or ready_for_pickup)
    // - If current is 'accepted': can only progress to 'cooking' (if any/all items are cooking/ready; must NOT skip to ready_for_pickup)
    // - If current is 'cooking': can progress to 'ready_for_pickup' if all items are ready
    // - If current is 'ready_for_pickup': remains ready_for_pickup until explicit completion action
    if (currentStatus === 'accepted' && anyCookingOrReady) {
      newPrepStatus = 'cooking';
    } else if (currentStatus === 'cooking' && allReady) {
      newPrepStatus = 'ready_for_pickup';
    }

    await updateKitchenTicketFirestore(ticketId, {
      items: updatedItems,
      prepStatus: newPrepStatus
    });
  }

  async updateStationStatus(stationId: string, status: 'normal' | 'busy' | 'overloaded', chefName?: string): Promise<void> {
    const stationRef = doc(db, COLLECTIONS.STATIONS, stationId);
    const updates: any = { status };
    if (chefName) updates.assignedChef = chefName;
    await updateDoc(stationRef, updates);
  }

  async createKitchenTicketFromOrder(order: any): Promise<KitchenTicket> {
    const nowIso = new Date().toISOString();
    const items: KitchenOrderItem[] = (order.items || []).map((i: any) => ({
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      notes: i.notes || '',
      selectedOptions: i.selectedOptions || [],
      assignedStation: routeProductToStation(i.productName, i.category),
      itemStatus: 'new'
    }));

    const ticket: KitchenTicket = {
      id: order.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderTime: order.createdAt || nowIso,
      orderType: order.orderType || 'dine_in',
      tableNumber: order.tableNumber || '',
      customerName: order.customerName || 'Guest',
      items,
      prepStatus: 'new',
      priority: 'normal',
      estimatedPrepTimeMinutes: 15,
      notes: order.notes || '',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const ticketRef = doc(db, COLLECTIONS.KITCHEN_ORDERS, order.id);
    await updateKitchenTicketFirestore(order.id, ticket as any);
    return ticket;
  }

  async logKitchenWaste(wasteData: Omit<KitchenWasteLog, 'id' | 'createdAt'>): Promise<string> {
    const token = await getAuthToken();
    const response = await fetch(getApiUrl('/api/kitchen/waste'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ wasteData })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Log Kitchen Waste Failed (${response.status})`);
    }

    const data = await response.json();
    return data.id;
  }

  async fetchKitchenWasteLogs(): Promise<KitchenWasteLog[]> {
    const q = query(collection(db, COLLECTIONS.KITCHEN_WASTE), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as KitchenWasteLog));
  }
}
