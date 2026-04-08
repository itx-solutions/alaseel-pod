/** GET /api/reports/summary — response body */
export type ReportSummaryDto = {
  total_orders: number;
  completed_orders: number;
  attempted_orders: number;
  pending_orders: number;
  completion_rate: number;
  orders_by_source: {
    manual: number;
    shopify: number;
    email: number;
  };
  orders_by_driver: Array<{
    driver_id: string;
    driver_name: string;
    total_deliveries: number;
    completed: number;
    attempted: number;
    completion_rate: number;
  }>;
  daily_breakdown: Array<{
    date: string;
    total: number;
    completed: number;
    attempted: number;
  }>;
};
