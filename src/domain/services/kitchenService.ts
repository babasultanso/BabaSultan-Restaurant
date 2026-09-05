import {
  KitchenTicket,
  KitchenStation,
  KitchenWasteLog,
  KitchenPerformanceMetrics,
  KitchenPrepStatus
} from '../entities/kitchen';
import { kitchenAudioService } from './kitchenAudioService';

export class KitchenService {

  /**
   * Sound Notification for New Orders using Shared Audio Service
   */
  public playNewOrderChime(orderCount: number = 1) {
    kitchenAudioService.triggerNewOrderAlarm(orderCount);
  }

  /**
   * Calculate elapsed prep time in minutes
   */
  public getElapsedTimeMinutes(orderTimeIso: string): number {
    const elapsedMs = Date.now() - new Date(orderTimeIso).getTime();
    return Math.max(0, Math.floor(elapsedMs / 60000));
  }

  /**
   * Format elapsed timer display as MM:SS
   */
  public formatTimerDisplay(orderTimeIso: string): string {
    const elapsedSecs = Math.max(0, Math.floor((Date.now() - new Date(orderTimeIso).getTime()) / 1000));
    const mins = Math.floor(elapsedSecs / 60);
    const secs = elapsedSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Check if order is delayed beyond threshold
   */
  public isOrderDelayed(ticket: KitchenTicket, thresholdMinutes = 15): boolean {
    if (ticket.prepStatus === 'completed' || ticket.prepStatus === 'cancelled') return false;
    const elapsedMins = this.getElapsedTimeMinutes(ticket.orderTime);
    const maxAllowed = ticket.estimatedPrepTimeMinutes || thresholdMinutes;
    return elapsedMins >= maxAllowed;
  }

  /**
   * Calculate comprehensive kitchen operational metrics
   */
  public calculatePerformanceMetrics(
    tickets: KitchenTicket[],
    stations: KitchenStation[],
    wasteLogs: KitchenWasteLog[] = []
  ): KitchenPerformanceMetrics {
    const activeTickets = tickets.filter(
      t => t.prepStatus !== 'completed' && t.prepStatus !== 'cancelled'
    );
    const completedTickets = tickets.filter(t => t.prepStatus === 'completed');

    const delayedTickets = activeTickets.filter(t => this.isOrderDelayed(t));

    // Calculate average preparation time for completed orders
    let totalPrepTimeMins = 0;
    let completedWithTime = 0;

    completedTickets.forEach(t => {
      if (t.startedAt && t.readyAt) {
        const diff = (new Date(t.readyAt).getTime() - new Date(t.startedAt).getTime()) / 60000;
        totalPrepTimeMins += Math.max(1, Math.round(diff));
        completedWithTime++;
      } else if (t.orderTime && t.completedAt) {
        const diff = (new Date(t.completedAt).getTime() - new Date(t.orderTime).getTime()) / 60000;
        totalPrepTimeMins += Math.max(1, Math.round(diff));
        completedWithTime++;
      }
    });

    const avgPrepTimeMinutes = completedWithTime > 0 ? Math.round(totalPrepTimeMins / completedWithTime) : 0;

    // Station statistics
    const stationStats = stations.map(st => {
      const stationActiveCount = activeTickets.filter(t =>
        t.items.some(item => item.assignedStation === st.stationType && item.itemStatus !== 'completed')
      ).length;

      return {
        stationType: st.stationType,
        stationName: st.name,
        activeCount: stationActiveCount,
        avgPrepTime: st.avgPrepTimeMinutes || avgPrepTimeMinutes,
        status: (stationActiveCount > 5 ? 'overloaded' : stationActiveCount > 3 ? 'busy' : 'normal') as 'normal' | 'busy' | 'overloaded'
      };
    });

    // Chef performance breakdown
    const chefMap = new Map<string, { chefName: string; station: string; itemsCompleted: number; totalSpeed: number }>();

    stations.forEach(s => {
      if (s.assignedChef) {
        chefMap.set(s.assignedChef, {
          chefName: s.assignedChef,
          station: s.name,
          itemsCompleted: s.completedOrdersToday || 0,
          totalSpeed: s.avgPrepTimeMinutes || 0
        });
      }
    });

    const chefPerformance = Array.from(chefMap.values()).map(c => ({
      chefName: c.chefName,
      station: c.station,
      itemsCompleted: c.itemsCompleted,
      avgSpeedMins: c.totalSpeed
    }));

    return {
      activeOrdersCount: activeTickets.length,
      completedOrdersCount: completedTickets.length,
      delayedOrdersCount: delayedTickets.length,
      avgPrepTimeMinutes,
      stationStats,
      chefPerformance
    };
  }
}

export const kitchenService = new KitchenService();
