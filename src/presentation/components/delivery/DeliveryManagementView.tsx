import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../../lib/firebase';
import { getCanonicalBranchId, getBranchDisplayName, areBranchesMatching } from '../../../lib/branchUtils';
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
  Language 
} from '../../../types';
import { 
  createDriver, 
  updateDriver, 
  deleteDriver, 
  updateDriverLocation, 
  setDriverAvailability, 
  createDeliveryOrder, 
  assignDriverToDelivery, 
  updateDeliveryStatus, 
  rateDelivery, 
  createDeliveryZone, 
  updateDeliveryZone, 
  deleteDeliveryZone, 
  calculateDeliveryAnalytics
} from '../../../lib/deliveryService';
import { exportToExcel, printReportWindow } from '../../../lib/reports';
import {
  Truck,
  Bike,
  Car,
  Navigation,
  MapPin,
  Clock,
  Phone,
  UserCheck,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Star,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  ShieldCheck,
  RotateCcw,
  Zap,
  Activity,
  Layers,
  Radio,
  Send,
  Bell,
  Award,
  ChevronRight,
  Compass,
  Building2,
  PackageCheck
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import { useAuth } from '../../context/AuthContext';

interface DeliveryManagementViewProps {
  initialDrivers?: DeliveryDriver[];
  initialDeliveries?: DeliveryOrder[];
  initialZones?: DeliveryZone[];
  language?: Language;
}

export const DeliveryManagementView: React.FC<DeliveryManagementViewProps> = ({
  initialDrivers,
  initialDeliveries,
  initialZones,
  language
}) => {
  const { userRecord, role, language: authLang } = useAuth();
  const currentLang = (language || authLang || 'en') as Language;

  const [activeTab, setActiveTab] = useState<
    'active_tracking' | 'drivers_roster' | 'zones_fees' | 'analytics_leaderboard' | 'notifications'
  >('active_tracking');

  // Realtime Firestore State
  const [drivers, setDrivers] = useState<DeliveryDriver[]>(
    initialDrivers && initialDrivers.length > 0 ? initialDrivers : []
  );
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>(
    initialDeliveries && initialDeliveries.length > 0 ? initialDeliveries : []
  );
  const [zones, setZones] = useState<DeliveryZone[]>(
    initialZones && initialZones.length > 0 ? initialZones : []
  );
  const [notifications, setNotifications] = useState<DeliveryNotification[]>([]);

  // Selected Delivery for Live Map Tracking
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>(
    deliveries[0]?.id || ''
  );

  // Modals
  const [showDriverModal, setShowDriverModal] = useState<boolean>(false);
  const [editingDriver, setEditingDriver] = useState<DeliveryDriver | null>(null);

  const [showZoneModal, setShowZoneModal] = useState<boolean>(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);

  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [assignDeliveryId, setAssignDeliveryId] = useState<string>('');
  const [selectedDriverForAssign, setSelectedDriverForAssign] = useState<string>('');

  // Driver Form
  const [driverForm, setDriverForm] = useState<{
    fullName: string;
    employeeId: string;
    phoneNumber: string;
    vehicleType: VehicleType;
    vehicleNumber: string;
    licenseNumber: string;
    status: DriverStatus;
    availability: DriverAvailability;
    address: string;
    branchId: string;
  }>({
    fullName: '',
    employeeId: '',
    phoneNumber: '+252 61 ',
    vehicleType: 'motorcycle',
    vehicleNumber: '',
    licenseNumber: '',
    status: 'active',
    availability: 'available',
    address: 'Mogadishu Central',
    branchId: 'branch_hq_01'
  });

  // Zone Form
  const [zoneForm, setZoneForm] = useState<{
    name: string;
    code: string;
    city: string;
    coverageRadiusKm: number;
    baseDeliveryFee: number;
    minOrderAmount: number;
    estimatedTimeMinutes: number;
    isActive: boolean;
    branchId: string;
  }>({
    name: '',
    code: '',
    city: 'Mogadishu',
    coverageRadiusKm: 5,
    baseDeliveryFee: 3.00,
    minOrderAmount: 15.00,
    estimatedTimeMinutes: 30,
    isActive: true,
    branchId: ''
  });

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Role and Branch Authorization checks
  const isAuthorizedRole = useMemo(() => {
    const userRoleStr = (userRecord?.role || role || '').toLowerCase();
    return ['owner', 'admin', 'manager', 'cashier', 'staff', 'driver', 'delivery driver'].includes(userRoleStr);
  }, [userRecord, role]);

  const isDriverOnly = useMemo(() => {
    const userRoleStr = (userRecord?.role || role || '').toLowerCase();
    return (userRoleStr === 'driver' || userRoleStr === 'delivery driver') && !['owner', 'admin', 'manager', 'cashier'].includes(userRoleStr);
  }, [userRecord, role]);

  const isHqUser = useMemo(() => {
    const userRoleStr = (userRecord?.role || role || '').toLowerCase();
    const userBranch = userRecord?.branchId || (userRecord as any)?.branch;
    return userRoleStr === 'owner' || (userRoleStr === 'admin' && (userBranch === 'all' || !userBranch));
  }, [userRecord, role]);

  const canAssignDelivery = (del?: DeliveryOrder | null) => {
    if (!del || !isAuthorizedRole || isDriverOnly) return false;
    // Check if status is unassigned / pending or without driver
    const isUnassignedStatus = del.status === 'unassigned' || del.status === 'pending' || !del.driverId;
    if (!isUnassignedStatus) return false;

    // Check branch permissions
    if (isHqUser) return true;
    if (!del.branchId) return true;
    const userBranch = getCanonicalBranchId(userRecord?.branchId || (userRecord as any)?.branch);
    if (!userBranch || userBranch === 'all') return true;
    return getCanonicalBranchId(del.branchId) === userBranch;
  };

  // Realtime Firestore listeners
  useEffect(() => {
    const rawUserBranch = userRecord?.branchId || (userRecord as any)?.branch;
    const userBranch = getCanonicalBranchId(rawUserBranch);
    const isBranchScoped = !isHqUser && Boolean(rawUserBranch) && rawUserBranch !== 'all';

    const driversQuery = isBranchScoped && userBranch
      ? query(collection(db, COLLECTIONS.DRIVERS), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.DRIVERS));

    const unsubDrivers = onSnapshot(
      driversQuery,
      (snap) => {
        const list: DeliveryDriver[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const canonBranch = getCanonicalBranchId(data.branchId || data.branch || userBranch || 'branch_hq_01');
          const canonBranchName = data.branchName || getBranchDisplayName(canonBranch);

          // If branch-scoped, ensure driver branch matches user's branch
          if (isBranchScoped && userBranch && !areBranchesMatching(canonBranch, userBranch)) {
            return;
          }

          // Normalize status and availability
          let normalizedStatus: DriverStatus = 'active';
          let normalizedAvailability: DriverAvailability = 'available';

          const rawStatus = String(data.status || '').toLowerCase().trim();
          const rawAvail = String(data.availability || '').toLowerCase().trim();

          if (rawStatus === 'inactive' || rawStatus === 'suspended' || data.isActive === false) {
            normalizedStatus = 'inactive';
          } else if (rawStatus === 'on_break') {
            normalizedStatus = 'on_break';
          } else if (rawStatus === 'off_duty') {
            normalizedStatus = 'off_duty';
          } else if (rawStatus === 'offline') {
            normalizedStatus = 'offline';
          } else {
            normalizedStatus = 'active';
          }

          if (rawAvail === 'on_delivery' || rawAvail === 'in_transit' || rawStatus === 'in_transit') {
            normalizedAvailability = 'on_delivery';
          } else if (rawAvail === 'offline' || rawStatus === 'offline') {
            normalizedAvailability = 'offline';
          } else {
            normalizedAvailability = 'available';
          }

          list.push({
            id: d.id,
            ...data,
            fullName: data.fullName || data.name || 'Driver',
            employeeId: data.employeeId || `EMP-${d.id.slice(-5)}`,
            phoneNumber: data.phoneNumber || data.phone || '',
            vehicleType: data.vehicleType || 'motorcycle',
            vehicleNumber: data.vehicleNumber || '',
            licenseNumber: data.licenseNumber || '',
            status: normalizedStatus,
            availability: normalizedAvailability,
            branchId: canonBranch,
            branchName: canonBranchName,
          } as DeliveryDriver);
        });

        setDrivers(list);
      },
      (err) => {
        console.warn('Firestore drivers listener fallback:', err?.message || err);
      }
    );

    const deliveriesQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.DELIVERIES), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.DELIVERIES));

    const unsubDeliveries = onSnapshot(
      deliveriesQuery,
      (snap) => {
        const list: DeliveryOrder[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const deliveryNum = data.deliveryNumber || data.orderNumber || `DEL-${d.id.slice(-6).toUpperCase()}`;
          const normalizedStatus: DeliveryStatus = (data.status || data.deliveryStatus || 'unassigned') as DeliveryStatus;
          list.push({
            id: d.id,
            orderId: data.orderId || d.id,
            customerName: data.customerName || 'Delivery Customer',
            customerPhone: data.customerPhone || data.phone || '',
            deliveryZoneId: data.deliveryZoneId || data.zoneId || '',
            deliveryZoneName: data.deliveryZoneName || data.zoneName || '',
            branchId: data.branchId || '',
            branchName: data.branchName || '',
            driverId: data.driverId || undefined,
            driverName: data.driverName || (data.driverId ? 'Assigned Driver' : undefined),
            driverPhone: data.driverPhone || undefined,
            totalAmount: Number(data.totalAmount || data.total || 0),
            deliveryFee: Number(data.deliveryFee || 0),
            itemsCount: Number(data.itemsCount || (data.items ? data.items.length : 1)),
            estimatedDeliveryTimeMinutes: Number(data.estimatedDeliveryTimeMinutes || 30),
            createdAt: data.createdAt || new Date().toISOString(),
            ...data,
            // Guaranteed normalized properties
            deliveryNumber: deliveryNum,
            deliveryAddress: data.deliveryAddress || data.address || data.customerAddress || 'Address on file',
            status: normalizedStatus
          } as DeliveryOrder);
        });

        // Sort latest first
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setDeliveries(list);

        if (list.length > 0) {
          setSelectedDeliveryId((prev) => {
            if (prev && list.some((item) => item.id === prev)) return prev;
            const unassignedItem = list.find((item) => item.status === 'unassigned' || item.status === 'pending');
            const activeItem = list.find((item) => ['on_the_way', 'picked_up', 'assigned', 'accepted'].includes(item.status));
            return (unassignedItem || activeItem || list[0])?.id || '';
          });
        } else {
          setSelectedDeliveryId('');
        }
      },
      (err) => {
        console.warn('Firestore deliveries listener fallback:', err?.message || err);
      }
    );

    const zonesQuery = isBranchScoped && userBranch
      ? query(collection(db, COLLECTIONS.DELIVERY_ZONES), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.DELIVERY_ZONES));

    const unsubZones = onSnapshot(
      zonesQuery,
      (snap) => {
        const list: DeliveryZone[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const canonBranch = getCanonicalBranchId(data.branchId || data.branch || userBranch || 'branch_hq_01');
          if (isBranchScoped && userBranch && !areBranchesMatching(canonBranch, userBranch)) {
            return;
          }
          list.push({ id: d.id, ...data, branchId: canonBranch } as DeliveryZone);
        });
        setZones(list);
      },
      (err) => {
        console.warn('Firestore zones listener fallback:', err?.message || err);
      }
    );

    const unsubNotifs = onSnapshot(
      query(collection(db, COLLECTIONS.DELIVERY_NOTIFICATIONS)),
      (snap) => {
        const list: DeliveryNotification[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as DeliveryNotification));
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(list);
      },
      (err) => {
        console.warn('Firestore notifications listener fallback:', err?.message || err);
      }
    );

    return () => {
      unsubDrivers();
      unsubDeliveries();
      unsubZones();
      unsubNotifs();
    };
  }, [userRecord?.branchId, (userRecord as any)?.branch, isHqUser]);

  // Compute Logistics Analytics
  const analytics = useMemo(() => {
    return calculateDeliveryAnalytics(deliveries, drivers);
  }, [deliveries, drivers]);

  // Selected Active Delivery for Live GPS Telemetry View
  const currentTrackingDelivery = useMemo(() => {
    return deliveries.find((d) => d.id === selectedDeliveryId) || deliveries[0];
  }, [deliveries, selectedDeliveryId]);

  // Driver Form Submit
  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const canonBranch = getCanonicalBranchId(driverForm.branchId || userRecord?.branchId || (userRecord as any)?.branch || 'branch_hq_01');
      const payload = {
        fullName: driverForm.fullName,
        employeeId: driverForm.employeeId || `EMP-${Date.now().toString().slice(-4)}`,
        phoneNumber: driverForm.phoneNumber,
        vehicleType: driverForm.vehicleType,
        vehicleNumber: driverForm.vehicleNumber,
        licenseNumber: driverForm.licenseNumber,
        status: driverForm.status,
        availability: driverForm.availability,
        branchId: canonBranch,
        branchName: getBranchDisplayName(canonBranch),
        currentLocation: {
          lat: 2.0469,
          lng: 45.3181,
          address: driverForm.address
        }
      };

      if (editingDriver) {
        await updateDriver(editingDriver.id, payload);
        showToast(`Driver "${driverForm.fullName}" updated successfully.`);
      } else {
        await createDriver(payload);
        showToast(`New Driver "${driverForm.fullName}" registered.`);
      }
      setShowDriverModal(false);
      setEditingDriver(null);
    } catch (err: any) {
      alert(`Error saving driver: ${err.message}`);
    }
  };

  const openEditDriver = (d: DeliveryDriver) => {
    setEditingDriver(d);
    setDriverForm({
      fullName: d.fullName,
      employeeId: d.employeeId,
      phoneNumber: d.phoneNumber,
      vehicleType: d.vehicleType,
      vehicleNumber: d.vehicleNumber,
      licenseNumber: d.licenseNumber,
      status: d.status,
      availability: d.availability,
      address: d.currentLocation?.address || 'Mogadishu Central',
      branchId: getCanonicalBranchId(d.branchId || 'branch_hq_01')
    });
    setShowDriverModal(true);
  };

  // Zone Form Submit
  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const canonBranch = getCanonicalBranchId(zoneForm.branchId || userRecord?.branchId || (userRecord as any)?.branch);
      if (!canonBranch) {
        alert('Unable to determine your branch. Please reload your account profile or contact an administrator.');
        return;
      }

      if (!isHqUser) {
        const userBranch = getCanonicalBranchId(userRecord?.branchId || (userRecord as any)?.branch);
        if (!userBranch || !areBranchesMatching(canonBranch, userBranch)) {
          alert('Cross-branch operation rejected: You can only create or manage delivery zones for your assigned branch.');
          return;
        }
      }

      const rawFee = typeof zoneForm.baseDeliveryFee === 'number' ? zoneForm.baseDeliveryFee : parseFloat(String(zoneForm.baseDeliveryFee));
      const validatedFee = Number.isFinite(rawFee) && rawFee >= 0 ? rawFee : 0;

      const payload = {
        name: zoneForm.name.trim(),
        code: zoneForm.code.trim() || `Z-MOG-0${zones.length + 1}`,
        city: zoneForm.city.trim() || 'Mogadishu',
        coverageRadiusKm: Number(zoneForm.coverageRadiusKm) || 5,
        baseDeliveryFee: validatedFee,
        minOrderAmount: Number(zoneForm.minOrderAmount) || 0,
        estimatedTimeMinutes: Number(zoneForm.estimatedTimeMinutes) || 25,
        isActive: Boolean(zoneForm.isActive),
        branchId: canonBranch,
        branchName: getBranchDisplayName(canonBranch)
      };

      if (editingZone) {
        await updateDeliveryZone(editingZone.id, payload);
        showToast(`Zone "${zoneForm.name}" updated.`);
      } else {
        await createDeliveryZone(payload);
        showToast(`New Delivery Zone "${zoneForm.name}" created.`);
      }
      setShowZoneModal(false);
      setEditingZone(null);
    } catch (err: any) {
      alert(`Error saving zone: ${err.message}`);
    }
  };

  const openEditZone = (z: DeliveryZone) => {
    setEditingZone(z);
    const rawBranch = z.branchId || userRecord?.branchId || (userRecord as any)?.branch;
    const canonBranch = getCanonicalBranchId(rawBranch || (isHqUser ? 'branch_hq_01' : ''));
    const rawFee = typeof z.baseDeliveryFee === 'number' ? z.baseDeliveryFee : (typeof (z as any).deliveryFee === 'number' ? (z as any).deliveryFee : 0);
    setZoneForm({
      name: z.name || '',
      code: z.code || '',
      city: z.city || 'Mogadishu',
      coverageRadiusKm: typeof z.coverageRadiusKm === 'number' ? z.coverageRadiusKm : 5,
      baseDeliveryFee: Number.isFinite(rawFee) && rawFee >= 0 ? rawFee : 0,
      minOrderAmount: typeof z.minOrderAmount === 'number' ? z.minOrderAmount : 15.00,
      estimatedTimeMinutes: typeof z.estimatedTimeMinutes === 'number' ? z.estimatedTimeMinutes : 30,
      isActive: z.isActive !== false,
      branchId: canonBranch
    });
    setShowZoneModal(true);
  };

  // Open Assign Modal Helper
  const targetDeliveryForAssign = deliveries.find(d => d.id === assignDeliveryId);
  const eligibleDrivers = useMemo(() => {
    if (!targetDeliveryForAssign) {
      return drivers.filter(d => d.status === 'active' && d.availability !== 'offline');
    }
    const targetBranch = getCanonicalBranchId(targetDeliveryForAssign.branchId);
    return drivers.filter(d => {
      // Must be active
      if (d.status !== 'active') return false;

      // Cannot be offline
      if (d.availability === 'offline') return false;

      // If currently on delivery, only allowed if this driver is already assigned to this delivery (for re-confirmation)
      if ((d.availability === 'on_delivery' || d.availability === 'in_transit') && targetDeliveryForAssign.driverId !== d.id) {
        return false;
      }

      // Branch match check: HQ users can assign across branches; branch users can only assign drivers matching delivery branch
      const drvBranch = getCanonicalBranchId(d.branchId);
      if (drvBranch && targetBranch && !areBranchesMatching(drvBranch, targetBranch) && !isHqUser) {
        return false;
      }

      return true;
    });
  }, [drivers, targetDeliveryForAssign, isHqUser]);

  const openAssignModalForDelivery = (delivery: DeliveryOrder) => {
    setSelectedDeliveryId(delivery.id);
    setAssignDeliveryId(delivery.id);

    const targetBranch = getCanonicalBranchId(delivery.branchId);
    const matchingDrivers = drivers.filter(d => {
      if (d.status !== 'active') return false;
      if (d.availability === 'offline') return false;
      if ((d.availability === 'on_delivery' || d.availability === 'in_transit') && delivery.driverId !== d.id) {
        return false;
      }
      const drvBranch = getCanonicalBranchId(d.branchId);
      const isBranchOk = !targetBranch || !drvBranch || areBranchesMatching(drvBranch, targetBranch) || isHqUser;
      return isBranchOk;
    });

    const currentDrv = delivery.driverId ? matchingDrivers.find(d => d.id === delivery.driverId) : undefined;
    const availableDrv = matchingDrivers.find(d => d.availability === 'available');
    const defaultDrv = currentDrv || availableDrv;

    setSelectedDriverForAssign(defaultDrv?.id || '');
    setShowAssignModal(true);
  };

  // Handle Driver Assignment
  const handleConfirmAssign = async () => {
    if (!assignDeliveryId || !selectedDriverForAssign) {
      alert('Please select a driver!');
      return;
    }

    const drv = drivers.find((d) => d.id === selectedDriverForAssign);
    if (!drv) {
      alert('Selected driver not found.');
      return;
    }

    try {
      await assignDriverToDelivery(assignDeliveryId, drv.id, drv.fullName, drv.phoneNumber);
      showToast(`Driver ${drv.fullName} assigned to delivery ${assignDeliveryId.slice(-6)}.`);
      setShowAssignModal(false);
    } catch (err: any) {
      alert(`Error assigning driver: ${err.message}`);
    }
  };

  // Handle Delivery Status Advancement
  const handleAdvanceStatus = async (delivery: DeliveryOrder, nextStatus: DeliveryStatus) => {
    try {
      await updateDeliveryStatus(delivery.id, nextStatus, delivery.driverId);
      showToast(`Delivery ${delivery.deliveryNumber} status updated to "${nextStatus.replace('_', ' ').toUpperCase()}".`);
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  // Vehicle Icon helper
  const getVehicleIcon = (type: VehicleType) => {
    switch (type) {
      case 'motorcycle':
      case 'scooter':
        return <Bike className="w-4 h-4 text-emerald-400" />;
      case 'car':
        return <Car className="w-4 h-4 text-indigo-400" />;
      case 'van':
        return <Truck className="w-4 h-4 text-amber-400" />;
      default:
        return <Bike className="w-4 h-4 text-emerald-400" />;
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: DeliveryStatus) => {
    switch (status) {
      case 'unassigned':
      case 'pending':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">Unassigned</span>;
      case 'assigned':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Driver Assigned</span>;
      case 'accepted':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30">Driver Accepted</span>;
      case 'picked_up':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">Order Picked Up</span>;
      case 'on_the_way':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse flex items-center gap-1"><Radio className="w-3 h-3 text-emerald-400" /> On The Way</span>;
      case 'arrived':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Driver Arrived</span>;
      case 'delivered':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/30 text-emerald-400 border border-emerald-500/50 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Delivered</span>;
      case 'failed':
      case 'returned':
      case 'cancelled':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">{status}</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  // Filtered Deliveries
  const filteredDeliveries = deliveries.filter((d) => {
    const q = (searchQuery || '').toLowerCase();
    return (
      (d.deliveryNumber || '').toLowerCase().includes(q) ||
      (d.customerName || '').toLowerCase().includes(q) ||
      (d.driverName || '').toLowerCase().includes(q) ||
      (d.deliveryAddress || '').toLowerCase().includes(q)
    );
  });

  const COLORS = ['#10B981', '#6366F1', '#F59E0B', '#EF4444', '#06B6D4'];

  if (isDriverOnly) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
        <ShieldCheck className="w-12 h-12 text-indigo-400 mx-auto opacity-70" />
        <h3 className="text-lg font-bold text-white">Dispatcher Management Restricted</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Dispatch management controls and driver assignment tools are restricted to Dispatchers and Management. Please access your assigned deliveries via the Delivery Driver Portal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="font-bold text-xs">{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                <Truck className="w-3.5 h-3.5 text-emerald-400" /> Phase 14 Delivery & Logistics Engine
              </span>
              <span className="bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-teal-400" /> Live GPS Dispatch Center
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Truck className="w-8 h-8 text-emerald-400" />
              Delivery Management & Fleet Logistics HQ
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-3xl leading-relaxed">
              Real-time driver dispatching, live GPS order tracking, zone fee management, automated milestone notifications, and logistics efficiency analytics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isDriverOnly && (
              <>
                <button
                  onClick={() => {
                    setEditingDriver(null);
                    setDriverForm({
                      fullName: '',
                      employeeId: `EMP-DRV-${drivers.length + 105}`,
                      phoneNumber: '+252 61 ',
                      vehicleType: 'motorcycle',
                      vehicleNumber: '',
                      licenseNumber: '',
                      status: 'active',
                      availability: 'available',
                      address: 'Mogadishu Central',
                      branchId: getCanonicalBranchId(userRecord?.branchId || (userRecord as any)?.branch || 'branch_hq_01')
                    });
                    setShowDriverModal(true);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-2xl text-xs transition flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  <Plus className="w-4 h-4" /> Add New Driver
                </button>

                <button
                  onClick={() => {
                    const rawBranch = userRecord?.branchId || (userRecord as any)?.branch;
                    const userBranch = getCanonicalBranchId(rawBranch);
                    if (!isHqUser && !userBranch) {
                      alert('Unable to determine your branch. Please reload your account profile or contact an administrator.');
                      return;
                    }
                    const defaultBranch = isHqUser ? (userBranch || 'branch_hq_01') : userBranch;
                    setEditingZone(null);
                    setZoneForm({
                      name: '',
                      code: `Z-MOG-0${zones.length + 1}`,
                      city: 'Mogadishu',
                      coverageRadiusKm: 5,
                      baseDeliveryFee: 3.00,
                      minOrderAmount: 15.00,
                      estimatedTimeMinutes: 30,
                      isActive: true,
                      branchId: defaultBranch
                    });
                    setShowZoneModal(true);
                  }}
                  className="bg-teal-600 hover:bg-teal-500 text-white font-extrabold px-4 py-2.5 rounded-2xl text-xs transition flex items-center gap-2 cursor-pointer shadow-lg shadow-teal-600/20"
                >
                  <Plus className="w-4 h-4" /> Add Delivery Zone
                </button>
              </>
            )}

            <button
              onClick={() => {
                const cols = ['Delivery #', 'Customer', 'Driver', 'Status', 'Zone', 'Fee ($)', 'Total ($)', 'Rating'];
                const rows = deliveries.map((d) => [
                  d.deliveryNumber,
                  d.customerName,
                  d.driverName || 'Unassigned',
                  d.status,
                  d.deliveryZoneName || 'Standard',
                  `$${(d.deliveryFee || 0).toFixed(2)}`,
                  `$${(d.totalAmount || 0).toFixed(2)}`,
                  d.customerRating ? `${d.customerRating}★` : 'N/A'
                ]);
                exportToExcel('Logistics_Delivery_Performance_Audit', cols, rows);
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2.5 rounded-2xl text-xs transition flex items-center gap-2 cursor-pointer border border-slate-700"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export Audit (.XLSX)
            </button>
          </div>
        </div>

        {/* Real-time KPI Ribbon */}
        <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 relative z-10">
          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Active Deliveries</span>
            <span className="text-sm font-extrabold text-emerald-400 mt-0.5 block">{analytics.activeCount} In Transit</span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Pending Dispatch</span>
            <span className="text-sm font-extrabold text-amber-400 mt-0.5 block">{analytics.pendingCount} Orders</span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Completed Today</span>
            <span className="text-sm font-extrabold text-indigo-400 mt-0.5 block">{analytics.completedCount} Deliveries</span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Avg Delivery Time</span>
            <span className="text-sm font-extrabold text-teal-400 mt-0.5 block">{analytics.avgDeliveryTime} Mins</span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">On-Time Rate</span>
            <span className="text-sm font-extrabold text-cyan-400 mt-0.5 block">{analytics.onTimeRate}%</span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Delivery Fee Revenue</span>
            <span className="text-sm font-extrabold text-purple-400 mt-0.5 block">${(analytics.totalFees || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Sub Tabs Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-2.5 shadow-xl overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          <button
            onClick={() => setActiveTab('active_tracking')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'active_tracking'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <Navigation className="w-4 h-4" />
            Live GPS Tracking & Dispatch ({deliveries.length})
          </button>

          <button
            onClick={() => setActiveTab('drivers_roster')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'drivers_roster'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Drivers Roster & Fleet ({drivers.length})
          </button>

          <button
            onClick={() => setActiveTab('zones_fees')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'zones_fees'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <MapPin className="w-4 h-4" />
            Delivery Zones & Fee Rates ({zones.length})
          </button>

          <button
            onClick={() => setActiveTab('analytics_leaderboard')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'analytics_leaderboard'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Logistics Analytics & Driver Ranking
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'notifications'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <Bell className="w-4 h-4" />
            Live Event Notifications ({notifications.length})
          </button>
        </div>
      </div>

      {/* TAB 1: LIVE GPS TRACKING & DISPATCH */}
      {activeTab === 'active_tracking' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Deliveries List */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search order #, customer or address..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">
                {filteredDeliveries.length} Deliveries
              </span>
            </div>

            <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
              {filteredDeliveries.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center text-slate-400 text-xs">
                  No deliveries found.
                </div>
              ) : (
                filteredDeliveries.map((del) => {
                  const isSelected = del.id === currentTrackingDelivery?.id;
                  const canAssign = canAssignDelivery(del);
                  return (
                    <div
                      key={del.id}
                      onClick={() => setSelectedDeliveryId(del.id)}
                      className={`p-4 rounded-3xl border transition cursor-pointer space-y-3 ${
                        isSelected
                          ? 'bg-slate-900 border-emerald-500/80 shadow-lg shadow-emerald-500/10'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-emerald-400 text-sm">{del.deliveryNumber}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({del.orderId})</span>
                        </div>
                        {getStatusBadge(del.status)}
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                          <span>{del.customerName}</span>
                          <span className="text-[10px] text-slate-400">({del.customerPhone})</span>
                        </div>

                        <div className="text-slate-300 flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{del.deliveryAddress}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Driver:</span>
                          <span className="font-extrabold text-white">
                            {del.driverName || 'Unassigned'}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Total Bill:</span>
                          <span className="font-extrabold text-emerald-400">${(del.totalAmount || 0).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Direct Quick Action: Assign Driver on Card */}
                      {canAssign && (
                        <div className="pt-1">
                          <button
                            id={`btn-card-assign-${del.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openAssignModalForDelivery(del);
                            }}
                            className="w-full py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20 transition"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Assign Driver
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Live GPS Telematics & Control Hub */}
          <div className="lg:col-span-7 space-y-6">
            {currentTrackingDelivery ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-white">Tracking {currentTrackingDelivery.deliveryNumber}</h3>
                      {getStatusBadge(currentTrackingDelivery.status)}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Destination: {currentTrackingDelivery.deliveryAddress}
                    </p>
                  </div>

                  {canAssignDelivery(currentTrackingDelivery) ? (
                    <button
                      id={`btn-assign-driver-${currentTrackingDelivery.id}`}
                      onClick={() => openAssignModalForDelivery(currentTrackingDelivery)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2 rounded-2xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
                    >
                      <UserCheck className="w-4 h-4" /> Assign Driver Now
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      {currentTrackingDelivery.status === 'assigned' && (
                        <>
                          <button
                            onClick={() => openAssignModalForDelivery(currentTrackingDelivery)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer border border-slate-700"
                          >
                            Reassign
                          </button>
                          <button
                            onClick={() => handleAdvanceStatus(currentTrackingDelivery, 'accepted')}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer"
                          >
                            Accept Delivery
                          </button>
                        </>
                      )}
                      {currentTrackingDelivery.status === 'accepted' && (
                        <button
                          onClick={() => handleAdvanceStatus(currentTrackingDelivery, 'picked_up')}
                          className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer"
                        >
                          Pick Up Order
                        </button>
                      )}
                      {currentTrackingDelivery.status === 'picked_up' && (
                        <button
                          onClick={() => handleAdvanceStatus(currentTrackingDelivery, 'on_the_way')}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer"
                        >
                          On The Way
                        </button>
                      )}
                      {currentTrackingDelivery.status === 'on_the_way' && (
                        <button
                          onClick={() => handleAdvanceStatus(currentTrackingDelivery, 'arrived')}
                          className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer"
                        >
                          Driver Arrived
                        </button>
                      )}
                      {currentTrackingDelivery.status === 'arrived' && (
                        <button
                          onClick={() => handleAdvanceStatus(currentTrackingDelivery, 'delivered')}
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-3 py-1.5 rounded-xl text-xs cursor-pointer shadow-lg shadow-emerald-500/20"
                        >
                          Mark Delivered
                        </button>
                      )}
                      {['assigned', 'accepted', 'picked_up', 'on_the_way', 'arrived'].includes(currentTrackingDelivery.status) && (
                        <button
                          onClick={() => {
                            const reason = prompt('Enter failure reason:') || 'Customer unavailable';
                            updateDeliveryStatus(currentTrackingDelivery.id, 'failed', currentTrackingDelivery.driverId, reason);
                          }}
                          className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer border border-rose-500/30"
                        >
                          Fail Order
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Real GPS Telemetry Display */}
                <div className="relative w-full min-h-64 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden p-6 flex flex-col justify-between">
                  {/* Background Grid */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-20" />

                  {/* Top Telemetry Header */}
                  <div className="relative z-10 flex items-center justify-between text-xs">
                    {currentTrackingDelivery.currentLat && currentTrackingDelivery.currentLng ? (
                      <span className="bg-slate-900/90 backdrop-blur-md text-emerald-400 font-bold px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Live Telemetry Broadcasting
                      </span>
                    ) : (
                      <span className="bg-slate-900/90 backdrop-blur-md text-slate-400 font-medium px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" /> Live GPS Unavailable
                      </span>
                    )}

                    {currentTrackingDelivery.estimatedDeliveryTimeMinutes ? (
                      <span className="bg-slate-900/90 backdrop-blur-md text-slate-300 font-bold px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" /> Est. ETA: {currentTrackingDelivery.estimatedDeliveryTimeMinutes} mins
                      </span>
                    ) : null}
                  </div>

                  {/* Main Telemetry Body */}
                  <div className="relative z-10 my-6">
                    {currentTrackingDelivery.currentLat && currentTrackingDelivery.currentLng ? (
                      <div className="flex flex-col sm:flex-row items-center justify-around gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                            <Truck className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400 uppercase font-bold">Driver Telematics</div>
                            <div className="text-sm font-bold text-white">{currentTrackingDelivery.driverName || 'Assigned Courier'}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-slate-400">Coordinates</div>
                          <div className="text-xs font-mono text-emerald-400">{currentTrackingDelivery.currentLat.toFixed(4)}°, {currentTrackingDelivery.currentLng.toFixed(4)}°</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
                          <MapPin className="w-6 h-6 text-slate-500" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-300 mb-1">
                          {currentLang === 'ar' ? 'الموقع الحي غير متوفر' : 'Live GPS Unavailable'}
                        </h4>
                        <p className="text-xs text-slate-500 max-w-sm">
                          {currentLang === 'ar'
                            ? 'لم يقم جهاز السائق ببث إحداثيات GPS المباشرة بعد. سيتم تحديث الموقع تلقائياً بمجرد إرسال الإشارة.'
                            : 'Driver device has not broadcasted real-time coordinates yet. Telemetry will update automatically when received.'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Destination Summary */}
                  <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-slate-300 font-medium">{currentTrackingDelivery.deliveryAddress || 'No destination address'}</span>
                    </div>
                    <div>
                      Status: <span className="text-white font-bold uppercase">{currentTrackingDelivery.status}</span>
                    </div>
                  </div>
                </div>

                {/* Delivery Order Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <span className="font-bold text-white uppercase text-[10px] text-slate-400 block">Customer Information</span>
                    <p className="text-slate-200"><strong>Name:</strong> {currentTrackingDelivery.customerName}</p>
                    <p className="text-slate-200"><strong>Phone:</strong> {currentTrackingDelivery.customerPhone}</p>
                    <p className="text-slate-200"><strong>Address:</strong> {currentTrackingDelivery.deliveryAddress}</p>
                    <p className="text-slate-200"><strong>Payment:</strong> {(currentTrackingDelivery.paymentMethod || 'cash').toUpperCase()} ({currentTrackingDelivery.paymentStatus || 'completed'})</p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <span className="font-bold text-white uppercase text-[10px] text-slate-400 block">Delivery Package Summary</span>
                    <p className="text-slate-200"><strong>Items ({currentTrackingDelivery.itemsCount || 0}):</strong> {currentTrackingDelivery.itemsSummary || 'Standard Meal Package'}</p>
                    <p className="text-slate-200"><strong>Subtotal:</strong> ${(currentTrackingDelivery.subtotal || 0).toFixed(2)}</p>
                    <p className="text-slate-200"><strong>Delivery Fee:</strong> ${(currentTrackingDelivery.deliveryFee || 0).toFixed(2)}</p>
                    <p className="text-emerald-400 font-extrabold text-sm"><strong>Total Bill:</strong> ${(currentTrackingDelivery.totalAmount || 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 text-xs">
                Select a delivery from the left list to view live GPS tracking telematics.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DRIVERS ROSTER & FLEET */}
      {activeTab === 'drivers_roster' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {drivers.map((drv) => (
              <div key={drv.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 hover:border-slate-700 transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                      {getVehicleIcon(drv.vehicleType)}
                    </div>

                    <div>
                      <h4 className="font-extrabold text-white text-sm">{drv.fullName}</h4>
                      <span className="text-[10px] text-slate-400 font-mono block">{drv.employeeId} • {(drv.vehicleType || 'BIKE').toUpperCase()}</span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                    drv.availability === 'available'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : drv.availability === 'on_delivery'
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {(drv.availability || 'available').replace('_', ' ')}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{drv.phoneNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Plate: {drv.vehicleNumber} | Lic: {drv.licenseNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Location: {drv.currentLocation?.address || 'Active Territory'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-center text-xs">
                  <div className="bg-slate-950 p-2 rounded-xl">
                    <span className="text-[9px] text-slate-400 block">Rating</span>
                    <span className="font-extrabold text-amber-400 flex items-center justify-center gap-0.5 mt-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {drv.rating ? drv.rating.toFixed(1) : 'N/A'}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2 rounded-xl">
                    <span className="text-[9px] text-slate-400 block">Completed</span>
                    <span className="font-extrabold text-emerald-400 mt-0.5 block">{drv.completedDeliveries || 0}</span>
                  </div>

                  <div className="bg-slate-950 p-2 rounded-xl">
                    <span className="text-[9px] text-slate-400 block">Failed</span>
                    <span className="font-extrabold text-rose-400 mt-0.5 block">{drv.failedDeliveries || 0}</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                  <button
                    onClick={() => openEditDriver(drv)}
                    className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 cursor-pointer"
                    title="Edit Driver"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={async () => {
                      if (confirm(`Remove driver "${drv.fullName}" from fleet?`)) {
                        await deleteDriver(drv.id);
                        showToast(`Driver ${drv.fullName} deleted.`);
                      }
                    }}
                    className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 cursor-pointer"
                    title="Delete Driver"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: DELIVERY ZONES & FEE RATES */}
      {activeTab === 'zones_fees' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {zones.map((z) => (
              <div key={z.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono px-2.5 py-1 rounded-full uppercase">
                    {z.code}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${z.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    {z.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>

                <h4 className="font-extrabold text-white text-base">{z.name}</h4>
                <p className="text-xs text-slate-400">{z.city} • Radius: {z.coverageRadiusKm} km</p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <Building2 className="w-3 h-3 text-slate-400" />
                  <span>{z.branchName || getBranchDisplayName(z.branchId)}</span>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Base Delivery Fee:</span>
                    <span className="font-extrabold text-emerald-400">${(z.baseDeliveryFee || 0).toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">Min Order Amount:</span>
                    <span className="font-bold text-white">${(z.minOrderAmount || 0).toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">Est. Arrival Time:</span>
                    <span className="font-bold text-amber-400">{z.estimatedTimeMinutes} mins</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                  <button
                    onClick={() => openEditZone(z)}
                    className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 cursor-pointer"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete delivery zone "${z.name}"?`)) {
                        await deleteDeliveryZone(z.id);
                        showToast(`Zone ${z.name} deleted.`);
                      }
                    }}
                    className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: LOGISTICS ANALYTICS & DRIVER RANKING */}
      {activeTab === 'analytics_leaderboard' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" /> Driver Performance Leaderboard & Earnings
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-3 px-3">Rank</th>
                    <th className="py-3 px-3">Driver Name</th>
                    <th className="py-3 px-3">Vehicle</th>
                    <th className="py-3 px-3">Assigned</th>
                    <th className="py-3 px-3">Completed</th>
                    <th className="py-3 px-3">Driver Payout ($)</th>
                    <th className="py-3 px-3">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {analytics.driverPerformance.map((drv, idx) => (
                    <tr key={drv.driverId} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3 font-extrabold text-emerald-400">#{idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-white">{drv.driverName} ({drv.employeeId})</td>
                      <td className="py-3 px-3 text-slate-300 uppercase">{drv.vehicleType}</td>
                      <td className="py-3 px-3 text-slate-300">{drv.totalAssigned}</td>
                      <td className="py-3 px-3 font-extrabold text-emerald-400">{drv.completedCount}</td>
                      <td className="py-3 px-3 font-extrabold text-indigo-400">${(drv.earnings || 0).toFixed(2)}</td>
                      <td className="py-3 px-3 font-bold text-amber-400 flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {drv.rating}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: LIVE NOTIFICATIONS LOG */}
      {activeTab === 'notifications' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-400" /> Automated Delivery Notifications Stream
          </h3>

          <div className="space-y-3">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No notifications logged yet. Trigger delivery milestones to test automated notifications.
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3 text-xs">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-extrabold text-white text-sm">{n.title}</h5>
                    <p className="text-slate-300 mt-0.5">{n.message}</p>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      {new Date(n.createdAt).toLocaleTimeString()} • Target: {(n.targetUser || 'ALL').toUpperCase()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* DRIVER MODAL */}
      {showDriverModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-white">
              {editingDriver ? 'Edit Driver Profile' : 'Register New Delivery Driver'}
            </h3>

            <form onSubmit={handleSaveDriver} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={driverForm.fullName}
                  onChange={(e) => setDriverForm({ ...driverForm, fullName: e.target.value })}
                  placeholder="e.g. Hassan Abdi"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={driverForm.phoneNumber}
                  onChange={(e) => setDriverForm({ ...driverForm, phoneNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Vehicle Type</label>
                  <select
                    value={driverForm.vehicleType}
                    onChange={(e) => setDriverForm({ ...driverForm, vehicleType: e.target.value as VehicleType })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-white"
                  >
                    <option value="motorcycle">Motorcycle</option>
                    <option value="scooter">Scooter</option>
                    <option value="car">Car</option>
                    <option value="van">Van</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Vehicle Plate #</label>
                  <input
                    type="text"
                    required
                    value={driverForm.vehicleNumber}
                    onChange={(e) => setDriverForm({ ...driverForm, vehicleNumber: e.target.value })}
                    placeholder="MOG-9921"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Assigned Branch *</label>
                <select
                  value={driverForm.branchId}
                  onChange={(e) => setDriverForm({ ...driverForm, branchId: e.target.value })}
                  disabled={!isHqUser}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-white font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="branch_hq_01">Headquarters - Mogadishu Main (branch_hq_01)</option>
                  <option value="branch_hargeisa_01">Hargeisa Flagship Branch (branch_hargeisa_01)</option>
                  <option value="branch_kismayo_01">Kismayo Coastal Express (branch_kismayo_01)</option>
                </select>
                {!isHqUser && (
                  <p className="text-[10px] text-slate-500 mt-1">Locked to your authenticated branch ({getBranchDisplayName(driverForm.branchId)}).</p>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDriverModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black"
                >
                  Save Driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ZONE MODAL */}
      {showZoneModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-white">
              {editingZone ? 'Edit Delivery Zone' : 'Create Delivery Zone'}
            </h3>

            <form onSubmit={handleSaveZone} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Zone Name *</label>
                <input
                  type="text"
                  required
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                  placeholder="e.g. Hodan & Wadajir Corridor"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Zone Code *</label>
                  <input
                    type="text"
                    required
                    value={zoneForm.code}
                    onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value })}
                    placeholder="e.g. Z-MOG-01"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={zoneForm.city}
                    onChange={(e) => setZoneForm({ ...zoneForm, city: e.target.value })}
                    placeholder="e.g. Mogadishu"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Assigned Branch *</label>
                <select
                  value={zoneForm.branchId}
                  onChange={(e) => setZoneForm({ ...zoneForm, branchId: e.target.value })}
                  disabled={!isHqUser}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-white font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="branch_hq_01">Headquarters - Mogadishu Main (branch_hq_01)</option>
                  <option value="branch_hargeisa_01">Hargeisa Flagship Branch (branch_hargeisa_01)</option>
                  <option value="branch_kismayo_01">Kismayo Coastal Express (branch_kismayo_01)</option>
                </select>
                {!isHqUser && (
                  <p className="text-[10px] text-slate-500 mt-1">Locked to your authenticated branch ({getBranchDisplayName(zoneForm.branchId)}).</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Base Delivery Fee ($)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={zoneForm.baseDeliveryFee}
                    onChange={(e) => setZoneForm({ ...zoneForm, baseDeliveryFee: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Est. Time (Mins)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={zoneForm.estimatedTimeMinutes}
                    onChange={(e) => setZoneForm({ ...zoneForm, estimatedTimeMinutes: parseInt(e.target.value) || 25 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Coverage Radius (km)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={zoneForm.coverageRadiusKm}
                    onChange={(e) => setZoneForm({ ...zoneForm, coverageRadiusKm: parseFloat(e.target.value) || 5 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Min Order Amount ($)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={zoneForm.minOrderAmount}
                    onChange={(e) => setZoneForm({ ...zoneForm, minOrderAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowZoneModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black"
                >
                  Save Zone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN DRIVER MODAL */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-white">Assign Delivery Driver</h3>

            <div className="space-y-3 text-xs">
              <label className="block text-slate-400 font-bold">Select Available Driver:</label>
              {eligibleDrivers.length === 0 ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 text-xs">
                  No eligible drivers currently available. Drivers must be active and not currently on delivery.
                </div>
              ) : (
                <select
                  id="delivery-driver-select"
                  value={selectedDriverForAssign}
                  onChange={(e) => setSelectedDriverForAssign(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white font-bold"
                >
                  {eligibleDrivers.map((drv) => (
                    <option key={drv.id} value={drv.id}>
                      {drv.fullName} ({drv.vehicleType}) - {(drv.availability || 'AVAILABLE').toUpperCase()} {drv.id === targetDeliveryForAssign?.driverId ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              )}

              <div className="pt-3 flex justify-end gap-2">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAssign}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black"
                >
                  Confirm Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
