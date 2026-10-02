/**
 * Database types for the Supabase client, mirroring supabase/migrations.
 * Regenerate with `npx supabase gen types typescript --project-id <ref>`
 * once the CLI is linked; keep in sync with migrations until then.
 */

export type AppointmentStatus = "confirmed" | "completed" | "cancelled" | "no_show";
export type ScheduleExceptionType = "available" | "blocked" | "closed";

type Timestamps = { created_at: string; updated_at: string };

export type BarberRow = Timestamps & {
  id: string;
  user_id: string | null;
  public_name: string;
  salon_name: string | null;
  slug: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  address: string | null;
  city: string | null;
  maps_url: string | null;
  timezone: string;
  slot_interval_minutes: number;
  buffer_minutes: number;
  minimum_booking_notice_minutes: number;
  booking_horizon_days: number;
};

export type ServiceRow = Timestamps & {
  id: string;
  barber_id: string;
  name: string;
  duration_minutes: number;
  active: boolean;
  display_order: number;
};

export type BusinessHoursRow = {
  id: string;
  barber_id: string;
  /** 0 = Sunday … 6 = Saturday. */
  day_of_week: number;
  /** "HH:MM:SS" wall-clock time in the barber's timezone. */
  start_time: string;
  end_time: string;
  active: boolean;
};

export type ScheduleExceptionRow = {
  id: string;
  barber_id: string;
  /** "YYYY-MM-DD" in the barber's timezone. */
  date: string;
  type: ScheduleExceptionType;
  start_time: string | null;
  end_time: string | null;
  /** Private — never send to public clients. */
  reason: string | null;
  created_at: string;
};

export type ClientRow = Timestamps & {
  id: string;
  barber_id: string;
  full_name: string;
  /** Normalized E.164, e.g. +212612345678. */
  phone: string;
};

export type AppointmentRow = Timestamps & {
  id: string;
  barber_id: string;
  client_id: string;
  service_id: string;
  start_at: string;
  end_at: string;
  duration_snapshot: number;
  status: AppointmentStatus;
  client_note: string | null;
  public_token: string;
  cancelled_at: string | null;
};

type Table<Row, Required extends keyof Row, Optional extends keyof Row = never> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Pick<Row, Optional>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      barbers: Table<
        BarberRow,
        "public_name" | "slug" | "email",
        Exclude<keyof BarberRow, "public_name" | "slug" | "email">
      >;
      services: Table<
        ServiceRow,
        "barber_id" | "name" | "duration_minutes",
        "id" | "active" | "display_order" | "created_at" | "updated_at"
      >;
      business_hours: Table<
        BusinessHoursRow,
        "barber_id" | "day_of_week" | "start_time" | "end_time",
        "id" | "active"
      >;
      schedule_exceptions: Table<
        ScheduleExceptionRow,
        "barber_id" | "date" | "type",
        "id" | "start_time" | "end_time" | "reason" | "created_at"
      >;
      clients: Table<ClientRow, "barber_id" | "full_name" | "phone", "id" | "created_at" | "updated_at">;
      appointments: Table<
        AppointmentRow,
        "barber_id" | "client_id" | "service_id" | "start_at" | "end_at" | "duration_snapshot",
        "id" | "status" | "client_note" | "public_token" | "created_at" | "updated_at" | "cancelled_at"
      >;
    };
    Views: Record<string, never>;
    Functions: {
      book_appointment: {
        Args: {
          p_barber_id: string;
          p_service_id: string;
          p_start: string;
          p_duration: number;
          p_full_name: string;
          p_phone: string;
          p_note: string | null;
        };
        Returns: AppointmentRow;
      };
      move_appointment: { Args: { p_token: string; p_start: string }; Returns: AppointmentRow };
      replace_business_hours: {
        Args: { p_barber_id: string; p_hours: { dayOfWeek: number; start: string; end: string }[] };
        Returns: undefined;
      };
    };
    Enums: {
      appointment_status: AppointmentStatus;
      schedule_exception_type: ScheduleExceptionType;
    };
    CompositeTypes: Record<string, never>;
  };
};
