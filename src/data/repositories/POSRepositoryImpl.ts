import { collection, getDocs } from 'firebase/firestore';
import { db, COLLECTIONS, createOrderFirestore } from '../../lib/firebase';
import { IPOSRepository } from '../../domain/repositories/IPOSRepository';
import { POSCheckoutPayload, ReceiptData } from '../../domain/entities/pos';
import { Order } from '../../types';

export class POSRepositoryImpl implements IPOSRepository {
  async createOrder(payload: POSCheckoutPayload): Promise<ReceiptData> {
    const timestamp = new Date().toISOString();
    const dateCode = new Date().toISOString().replace(/[-:T.]/g, '').slice(2, 10);
    const randomSeq = Math.floor(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000));
    const orderNumber = `ORD-${dateCode}-${randomSeq}`;

    const calculatedCOGS = payload.items.reduce((sum, item) => {
      const itemCost = (typeof item.product.cost === 'number' ? item.product.cost : 0) * item.quantity;
      return sum + itemCost;
    }, 0);

    const profit = payload.totalAmount - calculatedCOGS;

    const fullOrder = await createOrderFirestore({
      orderNumber,
      customerName: payload.customerName || 'Walk-in Customer',
      customerPhone: payload.customerPhone || '',
      orderType: payload.orderType,
      deliveryAddress: payload.deliveryAddress,
      deliveryZoneId: payload.deliveryZoneId,
      deliveryZoneName: payload.deliveryZoneName,
      deliveryFee: payload.deliveryFee,
      tableNumber: payload.tableNumber || '',
      items: payload.items.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        unitCost: typeof i.product.cost === 'number' ? i.product.cost : 0,
        totalPrice: i.totalPrice,
        notes: i.selectedNotes || ''
      })),
      subtotal: payload.subtotal,
      tax: payload.tax,
      discountAmount: payload.discount,
      totalAmount: payload.totalAmount,
      paidAmount: payload.totalAmount,
      paymentAmount: payload.totalAmount,
      cogs: calculatedCOGS,
      profit,
      employeeId: payload.employeeId,
      employeeName: payload.employeeName,
      status: 'completed',
      prepStatus: 'preparing',
      deliveryStatus: payload.orderType === 'delivery' ? 'unassigned' : undefined,
      paymentMethod: payload.paymentMethod,
      paymentStatus: 'paid',
      amountTendered: payload.amountTendered || payload.totalAmount,
      changeDue: payload.changeDue || 0,
      createdAt: timestamp
    });

    return {
      orderId: fullOrder.id,
      orderNumber: fullOrder.orderNumber,
      timestamp,
      cashierName: payload.employeeName,
      orderType: payload.orderType,
      tableNumber: payload.tableNumber,
      customerName: payload.customerName || 'Walk-in Customer',
      items: payload.items,
      subtotal: fullOrder.subtotal,
      tax: fullOrder.tax,
      discount: fullOrder.discountAmount,
      totalAmount: fullOrder.totalAmount,
      paymentMethod: payload.paymentMethod,
      amountTendered: payload.amountTendered,
      changeDue: payload.changeDue
    };
  }

  async fetchRecentOrders(): Promise<Order[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.ORDERS));
    const orders: Order[] = [];
    snap.forEach(d => orders.push({ id: d.id, ...d.data() } as Order));
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
