import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where,
  writeBatch
} from 'firebase/firestore';
import { db, COLLECTIONS, assignDeliveryDriverFirestore, updateDeliveryStatusFirestore, getAuthToken } from './firebase';
import { getApiUrl } from './apiConfig';
import { getCanonicalBranchId, getBranchDisplayName } from './branchUtils';
import { 
  DeliveryDriver, 
  DriverStatus, 
  DriverAvailability, 
  VehicleType, 
  DeliveryOrder, 
  DeliveryStatus, 
  DeliveryTracking, 
  DeliveryZone, 
  DeliveryNotification,
  DeliveryReportData 
} from '../types';

// Driver Actions
export async function createDriver(driverData: Omit<DeliveryDriver, 'id' | 'createdAt'> & { id?: string }): Promise<string> {
  const newRef = driverData.id ? doc(db, COLLECTIONS.DRIVERS, driverData.id) : doc(collection(db, COLLECTIONS.DRIVERS));
  const canonicalBranch = getCanonicalBranchId((driverData as any).branchId || (driverData as any).branch);
  const canonicalBranchName = (driverData as any).branchName || getBranchDisplayName(canonicalBranch);

  const newDriver: DeliveryDriver = {
    ...driverData,
    branchId: canonicalBranch,
    branchName: canonicalBranchName,
    id: newRef.id,
    rating: driverData.rating ?? 5.0,
    totalDeliveries: driverData.totalDeliveries ?? 0,
    completedDeliveries: driverData.completedDeliveries ?? 0,
    failedDeliveries: driverData.failedDeliveries ?? 0,
    createdAt: new Date().toISOString()
  };
  await setDoc(newRef, newDriver, { merge: true });
  return newRef.id;
}

export async function updateDriver(driverId: string, updates: Partial<DeliveryDriver>): Promise<void> {
  const ref = doc(db, COLLECTIONS.DRIVERS, driverId);
  const normalizedUpdates = { ...updates };
  if (updates.branchId || (updates as any)?.branch) {
    normalizedUpdates.branchId = getCanonicalBranchId(updates.branchId || (updates as any)?.branch);
    normalizedUpdates.branchName = updates.branchName || getBranchDisplayName(normalizedUpdates.branchId);
  }
  await setDoc(ref, {
    ...normalizedUpdates,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export async function deleteDriver(driverId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.DRIVERS, driverId));
}

export async function updateDriverLocation(
  driverId: string, 
  lat: number, 
  lng: number, 
  address?: string
): Promise<void> {
  await updateDriver(driverId, {
    currentLocation: {
      lat,
      lng,
      address,
      lastUpdated: new Date().toISOString()
    }
  });
}

export async function setDriverAvailability(driverId: string, availability: DriverAvailability): Promise<void> {
  await updateDriver(driverId, { availability });
}

// Delivery Order Workflow Actions
export async function createDeliveryOrder(
  deliveryData: Omit<DeliveryOrder, 'id' | 'deliveryNumber' | 'createdAt' | 'status'>
): Promise<string> {
  const token = await getAuthToken();
  const res = await fetch(getApiUrl('/api/deliveries'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ deliveryData })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Create Delivery Order Failed (${res.status})`);
  }

  const data = await res.json();
  return data.id;
}

export async function assignDriverToDelivery(
  deliveryId: string, 
  driverId: string, 
  driverName: string, 
  driverPhone: string
): Promise<void> {
  await assignDeliveryDriverFirestore(deliveryId, driverId, driverName, driverPhone);

  // Add Notification
  await sendDeliveryNotification({
    deliveryId,
    title: 'Driver Assigned',
    message: `Driver ${driverName} has been assigned to Delivery ${deliveryId.slice(-6)}.`,
    type: 'driver_assigned',
    targetUser: 'customer'
  });
}

export async function updateDeliveryStatus(
  deliveryId: string, 
  newStatus: DeliveryStatus,
  driverId?: string,
  failureReason?: string,
  realCoords?: { lat: number; lng: number }
): Promise<void> {
  await updateDeliveryStatusFirestore(deliveryId, newStatus, driverId, failureReason);

  if (newStatus === 'arrived') {
    await sendDeliveryNotification({
      deliveryId,
      title: 'Driver Arrived',
      message: 'Your delivery driver has arrived at your destination!',
      type: 'driver_arrived',
      targetUser: 'customer'
    });
  } else if (newStatus === 'delivered') {
    await sendDeliveryNotification({
      deliveryId,
      title: 'Order Delivered',
      message: 'Your order has been successfully delivered. Thank you!',
      type: 'order_delivered',
      targetUser: 'customer'
    });
  }

  if (driverId && realCoords && Number.isFinite(realCoords.lat) && Number.isFinite(realCoords.lng)) {
    await addTrackingPoint(deliveryId, driverId, realCoords.lat, realCoords.lng, newStatus);
  }
}

export async function rateDelivery(deliveryId: string, rating: number, feedback?: string): Promise<void> {
  try {
    const token = await getAuthToken();
    const response = await fetch(getApiUrl(`/api/deliveries/${deliveryId}/rating`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ rating, feedback })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Delivery rating failed (${response.status})`);
    }
  } catch (err) {
    console.warn('Delivery rating note:', err);
  }
}

// Tracking History (Server Authoritative)
export async function addTrackingPoint(
  deliveryId: string, 
  driverId: string, 
  lat: number, 
  lng: number, 
  statusUpdate?: DeliveryStatus,
  note?: string,
  speedKmH?: number,
  heading?: number
): Promise<void> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    console.warn('[GPS Tracking] Invalid GPS coordinates rejected:', { lat, lng });
    return;
  }

  try {
    const token = await getAuthToken();
    const response = await fetch(getApiUrl(`/api/deliveries/${deliveryId}/tracking`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        driverId,
        lat,
        lng,
        speedKmH: typeof speedKmH === 'number' ? speedKmH : undefined,
        heading: typeof heading === 'number' ? heading : undefined,
        statusUpdate,
        note
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('Delivery tracking endpoint error:', errorData.error || response.status);
    }
  } catch (err) {
    console.warn('Delivery telemetry tracking note:', err);
  }
}

// Delivery Zones CRUD
export async function createDeliveryZone(zoneData: Omit<DeliveryZone, 'id' | 'createdAt'>): Promise<string> {
  const newRef = doc(collection(db, COLLECTIONS.DELIVERY_ZONES));
  let rawBranch = zoneData.branchId;
  if (!rawBranch && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('user_profile');
      if (stored) {
        const u = JSON.parse(stored);
        rawBranch = u.branchId || u.branch;
      }
    } catch {}
  }
  const effectiveBranchId = getCanonicalBranchId(rawBranch);
  if (!effectiveBranchId) {
    throw new Error('Unable to determine your branch. Please reload your account profile or contact an administrator.');
  }

  const rawFee = typeof zoneData.baseDeliveryFee === 'number' 
    ? zoneData.baseDeliveryFee 
    : (typeof (zoneData as any).deliveryFee === 'number' ? (zoneData as any).deliveryFee : 0);
  const validatedFee = Number.isFinite(rawFee) && rawFee >= 0 ? rawFee : 0;

  const newZone: DeliveryZone = {
    ...zoneData,
    branchId: effectiveBranchId,
    branchName: zoneData.branchName || getBranchDisplayName(effectiveBranchId),
    baseDeliveryFee: validatedFee,
    id: newRef.id,
    createdAt: new Date().toISOString()
  };
  await setDoc(newRef, newZone);
  return newRef.id;
}

export async function updateDeliveryZone(zoneId: string, updates: Partial<DeliveryZone>): Promise<void> {
  const normalizedUpdates: Partial<DeliveryZone> = { ...updates };
  if (updates.branchId || (updates as any)?.branch) {
    const canon = getCanonicalBranchId(updates.branchId || (updates as any)?.branch);
    if (canon) {
      normalizedUpdates.branchId = canon;
      normalizedUpdates.branchName = updates.branchName || getBranchDisplayName(canon);
    }
  }
  if (typeof updates.baseDeliveryFee === 'number') {
    normalizedUpdates.baseDeliveryFee = Number.isFinite(updates.baseDeliveryFee) && updates.baseDeliveryFee >= 0 ? updates.baseDeliveryFee : 0;
  }
  await setDoc(doc(db, COLLECTIONS.DELIVERY_ZONES, zoneId), normalizedUpdates, { merge: true });
}

export async function deleteDeliveryZone(zoneId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.DELIVERY_ZONES, zoneId));
}

// Delivery Notifications (Internal Operational Event Log - Server Authoritative)
export async function sendDeliveryNotification(
  notifData: Omit<DeliveryNotification, 'id' | 'createdAt' | 'read'>
): Promise<void> {
  try {
    const token = await getAuthToken();
    await fetch(getApiUrl('/api/deliveries/notifications'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(notifData)
    });
  } catch (err) {
    console.warn('[sendDeliveryNotification] Non-blocking notice:', err);
  }
}

// Delivery Analytics Calculation Engine
export function calculateDeliveryAnalytics(deliveries: DeliveryOrder[], drivers: DeliveryDriver[]) {
  const totalCount = deliveries.length;
  const completed = deliveries.filter((d) => d.status === 'delivered');
  const failed = deliveries.filter((d) => d.status === 'failed' || d.status === 'returned' || d.status === 'cancelled');
  const active = deliveries.filter((d) => ['assigned', 'accepted', 'picked_up', 'on_the_way', 'arrived'].includes(d.status));
  const pending = deliveries.filter((d) => d.status === 'pending');

  const totalFees = deliveries.reduce((sum, d) => sum + (d.deliveryFee || 0), 0);
  const totalTips = deliveries.reduce((sum, d) => sum + (d.tipAmount || 0), 0);
  const totalVolume = deliveries.reduce((sum, d) => sum + (d.totalAmount || 0), 0);

  // Avg Delivery Time calculation
  const completedWithTimes = completed.filter((d) => (d.actualDeliveryTimeMinutes && d.actualDeliveryTimeMinutes > 0) || (d.deliveredAt && d.createdAt));
  const avgDeliveryTime = completedWithTimes.length > 0
    ? Math.round(
        completedWithTimes.reduce((sum, d) => {
          if (d.actualDeliveryTimeMinutes) return sum + d.actualDeliveryTimeMinutes;
          if (d.deliveredAt && d.createdAt) {
            const mins = (new Date(d.deliveredAt).getTime() - new Date(d.createdAt).getTime()) / 60000;
            return sum + Math.min(120, Math.max(1, mins));
          }
          return sum;
        }, 0) / completedWithTimes.length
      )
    : 0;

  // On Time Rate %
  const onTimeCount = completed.filter((d) => {
    if (!d.actualDeliveryTimeMinutes) return false;
    return d.actualDeliveryTimeMinutes <= (d.estimatedDeliveryTimeMinutes || 30);
  }).length;
  const onTimeRate = completed.length > 0 ? Math.round((onTimeCount / completed.length) * 100) : 0;

  // Driver Performance Leaderboard
  const driverPerformance = drivers.map((drv) => {
    const drvDeliveries = deliveries.filter((d) => d.driverId === drv.id);
    const drvCompleted = drvDeliveries.filter((d) => d.status === 'delivered');
    const drvFailed = drvDeliveries.filter((d) => d.status === 'failed' || d.status === 'returned');
    const totalFeesEarned = drvCompleted.reduce((sum, d) => sum + ((d.deliveryFee || 0) * 0.7), 0); // 70% to driver
    const ratings = drvCompleted.filter((d) => typeof d.customerRating === 'number' && d.customerRating > 0).map((d) => d.customerRating!);
    const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : (drv.rating ? drv.rating.toFixed(1) : '0.0');

    return {
      driverId: drv.id,
      driverName: drv.fullName,
      employeeId: drv.employeeId,
      vehicleType: drv.vehicleType,
      status: drv.status,
      availability: drv.availability,
      totalAssigned: drvDeliveries.length,
      completedCount: drvCompleted.length,
      failedCount: drvFailed.length,
      earnings: totalFeesEarned,
      rating: parseFloat(avgRating as string)
    };
  }).sort((a, b) => b.completedCount - a.completedCount);

  return {
    totalCount,
    completedCount: completed.length,
    failedCount: failed.length,
    activeCount: active.length,
    pendingCount: pending.length,
    totalFees,
    totalTips,
    totalVolume,
    avgDeliveryTime,
    onTimeRate,
    driverPerformance,
    topDriver: driverPerformance[0] || null
  };
}
